import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { parentStudentLinksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreateLinkBody = z.object({
  studentId: z.string().optional(),
  studentName: z.string().min(1),
});

router.get("/parent-links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const links = await db
    .select()
    .from(parentStudentLinksTable)
    .where(eq(parentStudentLinksTable.parentId, req.user.id));

  res.json(links);
});

router.post("/parent-links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "studentName is required" }); return; }

  const [link] = await db
    .insert(parentStudentLinksTable)
    .values({
      tutorId: req.user.tutorId ?? null,
      parentId: req.user.id,
      studentId: parsed.data.studentId ?? null,
      studentName: parsed.data.studentName,
    })
    .returning();

  res.status(201).json(link);
});

router.delete("/parent-links/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  await db
    .delete(parentStudentLinksTable)
    .where(and(
      eq(parentStudentLinksTable.id, Number(req.params.id)),
      eq(parentStudentLinksTable.parentId, req.user.id),
    ));

  res.json({ success: true });
});

router.post("/auth/set-role", async (req: Request, res: Response) => {
  const { getAuth, clerkClient } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { role, tutorId } = req.body;
  if (role !== "parent" && role !== "student" && role !== "tutor") {
    res.status(400).json({ error: "Role must be parent, student, or tutor" });
    return;
  }

  // Tutors must have a @claritymathematics.com email
  if (role === "tutor") {
    const { clerkClient: cc } = await import("@clerk/express");
    const clerkUser = await cc.users.getUser(userId);
    const hasValidEmail = clerkUser.emailAddresses.some(e =>
      e.emailAddress.toLowerCase().endsWith("@claritymathematics.com")
    );
    if (!hasValidEmail) {
      res.status(403).json({
        error: "Tutor accounts require a @claritymathematics.com email address.",
        code: "INVALID_TUTOR_EMAIL",
      });
      return;
    }
  }

  // Students/parents link to a tutor: use the one provided, else the first tutor.
  let resolvedTutorId: string | null = null;
  if (role !== "tutor") {
    resolvedTutorId = tutorId ?? null;
    if (!resolvedTutorId) {
      const [firstTutor] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "tutor"))
        .limit(1);
      resolvedTutorId = firstTutor?.id ?? null;
    }
  }

  // The frontend never calls the row-creating /auth/user endpoint, so create
  // (or update) the user's row here when they pick a role during onboarding.
  const clerkUser = await clerkClient.users.getUser(userId);
  await db
    .insert(usersTable)
    .values({
      id: userId,
      username: clerkUser.username,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      profileImageUrl: clerkUser.imageUrl ?? null,
      role,
      tutorId: resolvedTutorId,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { role, tutorId: resolvedTutorId, updatedAt: new Date() },
    });

  const metadata: Record<string, string | null> = { role };
  if (resolvedTutorId && role !== "tutor") metadata.tutorId = resolvedTutorId;
  await clerkClient.users.updateUserMetadata(userId, { publicMetadata: metadata });

  res.json({ success: true, role, tutorId: resolvedTutorId });
});

export default router;
