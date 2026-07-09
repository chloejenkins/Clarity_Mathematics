import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { parentFeedbackTable, parentStudentLinksTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const UpsertBody = z.object({
  content: z.string().min(1),
  period: z.string().optional(),
});

function tutorOnly(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (req.user.role !== "tutor") {
    res.status(403).json({ error: "Tutor access only" });
    return false;
  }
  return true;
}

router.get("/parent-feedback", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  const rows = await db
    .select()
    .from(parentFeedbackTable)
    .where(eq(parentFeedbackTable.tutorId, req.user.id))
    .orderBy(desc(parentFeedbackTable.updatedAt));
  res.json(rows);
});

router.get("/parent-feedback/:studentId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (req.user.role === "tutor") {
    const rows = await db
      .select()
      .from(parentFeedbackTable)
      .where(eq(parentFeedbackTable.studentId, req.params.studentId))
      .orderBy(desc(parentFeedbackTable.updatedAt));
    res.json(rows);
    return;
  }

  if (req.user.role === "parent") {
    const links = await db
      .select()
      .from(parentStudentLinksTable)
      .where(eq(parentStudentLinksTable.parentId, req.user.id));
    // Allow a parent to read feedback for a linked child, or for themselves
    // (a parent acting as the family account for a young child).
    const linked =
      req.params.studentId === req.user.id ||
      links.some((l) => l.studentId === req.params.studentId);
    if (!linked) { res.status(403).json({ error: "Not linked to this student" }); return; }

    const rows = await db
      .select()
      .from(parentFeedbackTable)
      .where(eq(parentFeedbackTable.studentId, req.params.studentId))
      .orderBy(desc(parentFeedbackTable.updatedAt));
    res.json(rows);
    return;
  }

  res.status(403).json({ error: "Access denied" });
});

router.put("/parent-feedback/:studentId", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  const parsed = UpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const existing = await db
    .select()
    .from(parentFeedbackTable)
    .where(and(
      eq(parentFeedbackTable.studentId, req.params.studentId),
      eq(parentFeedbackTable.tutorId, req.user.id),
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(parentFeedbackTable)
      .set({ content: parsed.data.content, period: parsed.data.period ?? null })
      .where(and(
        eq(parentFeedbackTable.studentId, req.params.studentId),
        eq(parentFeedbackTable.tutorId, req.user.id),
      ))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(parentFeedbackTable)
      .values({
        tutorId: req.user.id,
        studentId: req.params.studentId,
        content: parsed.data.content,
        period: parsed.data.period ?? null,
      })
      .returning();
    res.status(201).json(created);
  }
});

router.delete("/parent-feedback/:studentId", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  await db.delete(parentFeedbackTable).where(and(
    eq(parentFeedbackTable.studentId, req.params.studentId),
    eq(parentFeedbackTable.tutorId, req.user.id),
  ));
  res.json({ success: true });
});

export default router;
