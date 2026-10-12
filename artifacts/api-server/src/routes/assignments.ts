import { Router, type IRouter, type Request, type Response } from "express";
import { db, assignmentsTable, usersTable, parentStudentLinksTable } from "@workspace/db";
import { submissionsTable } from "@workspace/db/schema";
import { eq, desc, and, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  ListAssignmentsResponse,
  UpdateAssignmentBody,
  DeleteAssignmentResponse,
} from "@workspace/api-zod";
import { isSelfOrLinkedParent } from "../lib/family";
import { deleteAssignmentAttachments } from "./uploads";

type UserRow = typeof usersTable.$inferSelect;
function displayName(u: UserRow | undefined): string {
  if (!u) return "User";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || u.email || "User";
}

const CreateAssignmentInput = z.object({
  assignedTo: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(), // ISO string; parsed to a Date below
  subject: z.string().optional(),
});

const router: IRouter = Router();

router.get("/assignments", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  let assignments;
  if (req.user.role === "tutor") {
    assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.tutorId, req.user.id))
      .orderBy(desc(assignmentsTable.createdAt));
  } else if (req.user.role === "parent") {
    // Parents see assignments for their linked children, plus any assigned to
    // themselves (a parent acting as the account for a young child).
    const links = await db
      .select({ studentId: parentStudentLinksTable.studentId })
      .from(parentStudentLinksTable)
      .where(and(
        eq(parentStudentLinksTable.parentId, req.user.id),
        eq(parentStudentLinksTable.status, "approved"),
        isNotNull(parentStudentLinksTable.studentId),
      ));
    const ids = Array.from(
      new Set([req.user.id, ...links.map((l) => l.studentId).filter((v): v is string => Boolean(v))]),
    );
    assignments = await db
      .select()
      .from(assignmentsTable)
      .where(inArray(assignmentsTable.assignedTo, ids))
      .orderBy(desc(assignmentsTable.createdAt));
  } else {
    // students see only assignments assigned to them
    assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.assignedTo, req.user.id))
      .orderBy(desc(assignmentsTable.createdAt));
  }

  // Attach the recipient's display name and submission status.
  const users = await db.select().from(usersTable);
  const nameById = new Map(users.map((u) => [u.id, displayName(u)]));

  const ids = assignments.map((a) => a.id);
  const subs = ids.length
    ? await db.select().from(submissionsTable).where(inArray(submissionsTable.assignmentId, ids))
    : [];
  const statusByAssignment = new Map<number, { submitted: boolean; reviewed: boolean }>();
  for (const a of assignments) {
    // A submission counts if it's from the person the assignment is for.
    const s = subs.find((x) => x.assignmentId === a.id && x.studentId === a.assignedTo);
    statusByAssignment.set(a.id, { submitted: Boolean(s), reviewed: Boolean(s?.reviewedAt) });
  }

  const hydrated = assignments.map((a) => ({
    ...a,
    assignedToName: a.assignedTo ? nameById.get(a.assignedTo) ?? null : null,
    submitted: statusByAssignment.get(a.id)?.submitted ?? false,
    reviewed: statusByAssignment.get(a.id)?.reviewed ?? false,
  }));

  res.json(ListAssignmentsResponse.parse(hydrated));
});

router.post("/assignments", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Only tutors can create assignments" }); return; }

  const parsed = CreateAssignmentInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Title and a recipient are required" }); return; }

  const { assignedTo, title, description, dueDate, subject } = parsed.data;

  // The recipient must be a real student or parent.
  const [recipient] = await db.select().from(usersTable).where(eq(usersTable.id, assignedTo)).limit(1);
  if (!recipient || (recipient.role !== "student" && recipient.role !== "parent")) {
    res.status(400).json({ error: "Assign the work to a student or parent" });
    return;
  }

  const [assignment] = await db
    .insert(assignmentsTable)
    .values({
      tutorId: req.user.id,
      assignedTo,
      title,
      description: description ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      subject: subject ?? null,
    })
    .returning();

  res.status(201).json({ ...assignment, assignedToName: displayName(recipient) });
});

router.patch("/assignments/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Only tutors can update assignments" }); return; }

  const id = Number(req.params.id);
  const [existing] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.tutorId && existing.tutorId !== req.user.id) {
    res.status(403).json({ error: "You can only edit your own assignments" });
    return;
  }

  const parsed = UpdateAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

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

  res.json(updated);
});

router.delete("/assignments/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Only tutors can delete assignments" }); return; }

  const id = Number(req.params.id);
  const [existing] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.tutorId && existing.tutorId !== req.user.id) {
    res.status(403).json({ error: "You can only delete your own assignments" });
    return;
  }

  // Take the work and files submitted for it along with the assignment.
  await db.delete(submissionsTable).where(eq(submissionsTable.assignmentId, id));
  await deleteAssignmentAttachments(id);
  await db.delete(assignmentsTable).where(eq(assignmentsTable.id, id));
  res.json(DeleteAssignmentResponse.parse({ success: true }));
});

const SubmitBody = z.object({ content: z.string().optional() });

router.post("/assignments/:id/submit", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "student" && req.user.role !== "parent") {
    res.status(403).json({ error: "Only students or parents can submit" });
    return;
  }

  const assignmentId = Number(req.params.id);
  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const content = parsed.data.content ?? "";

  // Only the person the assignment was given to can submit work for it.
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (assignment.assignedTo !== req.user.id) {
    res.status(403).json({ error: "This assignment isn't assigned to you" });
    return;
  }

  const existing = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.assignmentId, assignmentId), eq(submissionsTable.studentId, req.user.id)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(submissionsTable)
      .set({ content })
      .where(and(eq(submissionsTable.assignmentId, assignmentId), eq(submissionsTable.studentId, req.user.id)))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(submissionsTable)
      .values({ assignmentId, studentId: req.user.id, content })
      .returning();
    res.status(201).json(created);
  }
});

router.get("/assignments/:id/my-submission", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "student" && req.user.role !== "parent") {
    res.status(403).json({ error: "Students/parents only" });
    return;
  }

  // Returns the submission from the person the assignment is for: the caller
  // themselves, or (for a parent) their linked child, so a parent can follow
  // their child's work and the tutor's review.
  const assignmentId = Number(req.params.id);
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
  if (!assignment || !assignment.assignedTo) { res.json(null); return; }
  if (!(await isSelfOrLinkedParent(req.user, assignment.assignedTo))) { res.json(null); return; }

  const rows = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.assignmentId, assignmentId), eq(submissionsTable.studentId, assignment.assignedTo)))
    .limit(1);

  res.json(rows[0] ?? null);
});

router.get("/assignments/:id/submissions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Tutors only" }); return; }

  const assignmentId = Number(req.params.id);
  const [rows, users] = await Promise.all([
    db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.assignmentId, assignmentId))
      .orderBy(desc(submissionsTable.submittedAt)),
    db.select().from(usersTable),
  ]);
  const nameById = new Map(users.map((u) => [u.id, displayName(u)]));

  res.json(rows.map((r) => ({ ...r, studentName: nameById.get(r.studentId) ?? "Student" })));
});

// Tutor leaves a review comment on a submission (and marks it reviewed).
const ReviewBody = z.object({ comment: z.string().optional() });
router.post("/submissions/:id/review", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Tutors only" }); return; }

  const id = Number(req.params.id);
  const parsed = ReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const [sub] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id)).limit(1);
  if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, sub.assignmentId)).limit(1);
  if (!assignment || assignment.tutorId !== req.user.id) {
    res.status(403).json({ error: "You can only review your own assignments" });
    return;
  }

  const [updated] = await db
    .update(submissionsTable)
    .set({ tutorComment: parsed.data.comment?.trim() || null, reviewedAt: new Date() })
    .where(eq(submissionsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
