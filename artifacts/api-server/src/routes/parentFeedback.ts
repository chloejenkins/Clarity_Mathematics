import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { parentFeedbackTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
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
    .orderBy(desc(parentFeedbackTable.updatedAt));
  res.json(rows);
});

router.get("/parent-feedback/:studentId", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  const rows = await db
    .select()
    .from(parentFeedbackTable)
    .where(eq(parentFeedbackTable.studentId, req.params.studentId))
    .orderBy(desc(parentFeedbackTable.updatedAt));
  res.json(rows);
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
    .where(eq(parentFeedbackTable.studentId, req.params.studentId))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(parentFeedbackTable)
      .set({ content: parsed.data.content, period: parsed.data.period ?? null })
      .where(eq(parentFeedbackTable.studentId, req.params.studentId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(parentFeedbackTable)
      .values({
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
  await db.delete(parentFeedbackTable).where(eq(parentFeedbackTable.studentId, req.params.studentId));
  res.json({ success: true });
});

export default router;
