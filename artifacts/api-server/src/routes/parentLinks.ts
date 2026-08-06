import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { parentStudentLinksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { strictRateLimiter } from "../middlewares/rateLimit";
import { anyAllowedTutorEmail } from "../lib/tutorAllowlist";

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;
function displayName(u: UserRow | undefined): string {
  if (!u) return "Student";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || u.email || "Student";
}

const CreateLinkBody = z.object({
  studentEmail: z.string().trim().email("Enter a valid email"),
});

router.get("/parent-links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const [links, users] = await Promise.all([
    db.select().from(parentStudentLinksTable).where(eq(parentStudentLinksTable.parentId, req.user.id)),
    db.select().from(usersTable),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(
    links.map((l) => {
      const student = l.studentId ? userMap.get(l.studentId) : undefined;
      return {
        id: l.id,
        studentId: l.studentId,
        studentName: student ? displayName(student) : l.studentName,
        studentEmail: student?.email ?? null,
        linked: Boolean(l.studentId), // false = a name-only placeholder, not a real connection
      };
    }),
  );
});

router.post("/parent-links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }); return; }
  const email = parsed.data.studentEmail.toLowerCase();

  const users = await db.select().from(usersTable);
  const student = users.find((u) => (u.email ?? "").toLowerCase() === email);

  if (!student) {
    res.status(404).json({ error: "No student found with that email. Make sure they've signed up first." });
    return;
  }
  if (student.id === req.user.id) {
    res.status(400).json({ error: "You can't link to your own account." });
    return;
  }
  if (student.role === "tutor" || student.role === "parent") {
    res.status(400).json({ error: `That email belongs to a ${student.role} account, not a student.` });
    return;
  }

  const existing = await db
    .select()
    .from(parentStudentLinksTable)
    .where(and(eq(parentStudentLinksTable.parentId, req.user.id), eq(parentStudentLinksTable.studentId, student.id)))
    .limit(1);
  if (existing.length > 0) {
    res.json({ id: existing[0].id, studentId: student.id, studentName: displayName(student), studentEmail: student.email, linked: true });
    return;
  }

  const [link] = await db
    .insert(parentStudentLinksTable)
    .values({
      tutorId: student.tutorId ?? req.user.tutorId ?? null,
      parentId: req.user.id,
      studentId: student.id,
      studentName: displayName(student),
    })
    .returning();

  res.status(201).json({ id: link.id, studentId: student.id, studentName: displayName(student), studentEmail: student.email, linked: true });
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

router.post("/auth/set-role", strictRateLimiter, async (req: Request, res: Response) => {
  const { getAuth, clerkClient } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { role, tutorId } = req.body;
  if (role !== "parent" && role !== "student" && role !== "tutor") {
    res.status(400).json({ error: "Role must be parent, student, or tutor" });
    return;
  }

  // The tutor role is restricted to an explicit allowlist of email addresses
  // (TUTOR_EMAILS). This prevents any signed-up student/parent from promoting
  // themselves to tutor.
  if (role === "tutor") {
    const clerkUserForCheck = await clerkClient.users.getUser(userId);
    const allowed = anyAllowedTutorEmail(
      clerkUserForCheck.emailAddresses.map((e) => e.emailAddress),
    );
    if (!allowed) {
      res.status(403).json({
        error: "This email address is not authorized to create a tutor account.",
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
