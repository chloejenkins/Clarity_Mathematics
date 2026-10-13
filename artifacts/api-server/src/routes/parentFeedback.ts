import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { parentFeedbackTable, parentStudentLinksTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const SaveBody = z.object({
  content: z.string().trim().min(1),
  period: z.string().nullish(),
});

function tutorOnly(req: Request, res: Response): req is Request & Express.AuthedRequest {
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
      .where(eq(parentFeedbackTable.studentId, String(req.params.studentId)))
      .orderBy(desc(parentFeedbackTable.createdAt), desc(parentFeedbackTable.id));
    res.json(rows);
    return;
  }

  if (req.user.role === "parent") {
    const links = await db
      .select()
      .from(parentStudentLinksTable)
      .where(and(
        eq(parentStudentLinksTable.parentId, req.user.id),
        eq(parentStudentLinksTable.status, "approved"),
      ));
    // Allow a parent to read feedback for a linked child, or for themselves
    // (a parent acting as the family account for a young child).
    const linked =
      String(req.params.studentId) === req.user.id ||
      links.some((l) => l.studentId === String(req.params.studentId));
    if (!linked) { res.status(403).json({ error: "Not linked to this student" }); return; }

    const rows = await db
      .select()
      .from(parentFeedbackTable)
      .where(eq(parentFeedbackTable.studentId, String(req.params.studentId)))
      .orderBy(desc(parentFeedbackTable.createdAt), desc(parentFeedbackTable.id));
    res.json(rows);
    return;
  }

  res.status(403).json({ error: "Access denied" });
});

// Each save adds a dated entry, so parents keep the history of past periods.
router.post("/parent-feedback/:studentId", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  const parsed = SaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Write the report before saving" });
    return;
  }

  // Reports are about a student, or a parent acting as the family account.
  const studentId = String(req.params.studentId);
  const [subject] = await db.select().from(usersTable).where(eq(usersTable.id, studentId)).limit(1);
  if (!subject || (subject.role !== "student" && subject.role !== "parent")) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const [created] = await db
    .insert(parentFeedbackTable)
    .values({
      tutorId: req.user.id,
      studentId,
      content: parsed.data.content,
      period: parsed.data.period?.trim() || null,
    })
    .returning();
  res.status(201).json(created);
});

/** The report with this id, if the calling tutor wrote it; otherwise sends the error. */
async function ownEntry(req: Request & Express.AuthedRequest, res: Response) {
  const id = Number(req.params.id);
  const [entry] = Number.isInteger(id)
    ? await db.select().from(parentFeedbackTable).where(eq(parentFeedbackTable.id, id)).limit(1)
    : [];
  if (!entry) { res.status(404).json({ error: "Report not found" }); return null; }
  if (entry.tutorId !== req.user.id) { res.status(403).json({ error: "You can only change your own reports" }); return null; }
  return entry;
}

router.patch("/parent-feedback/entries/:id", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  const parsed = SaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Write the report before saving" });
    return;
  }
  const entry = await ownEntry(req, res);
  if (!entry) return;

  const [updated] = await db
    .update(parentFeedbackTable)
    .set({ content: parsed.data.content, period: parsed.data.period?.trim() || null })
    .where(eq(parentFeedbackTable.id, entry.id))
    .returning();
  res.json(updated);
});

router.delete("/parent-feedback/entries/:id", async (req: Request, res: Response) => {
  if (!tutorOnly(req, res)) return;
  const entry = await ownEntry(req, res);
  if (!entry) return;
  await db.delete(parentFeedbackTable).where(eq(parentFeedbackTable.id, entry.id));
  res.json({ success: true });
});

export default router;
