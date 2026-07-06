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

  const updates: Record<string, string | null> = { role };
  if (role !== "tutor" && tutorId) {
    updates.tutorId = tutorId;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  const metadata: Record<string, string | null> = { role };
  if (tutorId && role !== "tutor") metadata.tutorId = tutorId;
  await clerkClient.users.updateUserMetadata(userId, { publicMetadata: metadata });

  res.json({ success: true, role, tutorId: updates.tutorId ?? null });
});

export default router;
