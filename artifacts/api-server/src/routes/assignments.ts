import { Router, type IRouter, type Request, type Response } from "express";
import { db, assignmentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListAssignmentsResponse,
  CreateAssignmentBody,
  UpdateAssignmentBody,
  DeleteAssignmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/assignments", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const assignments = await db
    .select()
    .from(assignmentsTable)
    .orderBy(desc(assignmentsTable.createdAt));

  res.json(ListAssignmentsResponse.parse(assignments));
});

router.post("/assignments", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can create assignments" });
    return;
  }

  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { title, description, dueDate, subject } = parsed.data;

  const [assignment] = await db
    .insert(assignmentsTable)
    .values({
      title,
      description: description ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      subject: subject ?? null,
    })
    .returning();

  res.status(201).json(assignment);
});

router.patch("/assignments/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can update assignments" });
    return;
  }

  const id = Number(req.params.id);
  const parsed = UpdateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.subject !== undefined) updates.subject = parsed.data.subject;
  if (parsed.data.dueDate !== undefined) updates.dueDate = new Date(parsed.data.dueDate);

  const [updated] = await db
    .update(assignmentsTable)
    .set(updates)
    .where(eq(assignmentsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  res.json(updated);
});

router.delete("/assignments/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can delete assignments" });
    return;
  }

  const id = Number(req.params.id);
  await db.delete(assignmentsTable).where(eq(assignmentsTable.id, id));
  res.json(DeleteAssignmentResponse.parse({ success: true }));
});

export default router;
