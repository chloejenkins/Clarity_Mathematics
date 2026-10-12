import { Router, type IRouter, type Request, type Response } from "express";
import { db, tutoringSessionsTable, usersTable, parentStudentLinksTable } from "@workspace/db";
import { eq, desc, and, inArray, isNotNull } from "drizzle-orm";
import {
  ListSessionsResponse,
  CreateSessionBody,
  DeleteSessionResponse,
} from "@workspace/api-zod";
import { applyCancellation } from "../lib/billing";
import { z } from "zod";

const UpdateSessionInput = z.object({
  status: z.enum(["pending", "approved", "cancelled", "completed"]).optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().optional(), // ISO string; parsed to a Date below
});

const router: IRouter = Router();

router.get("/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { studentId } = req.query;
  let sessions;

  if (req.user.role === "tutor") {
    if (studentId) {
      sessions = await db
        .select()
        .from(tutoringSessionsTable)
        .where(and(
          eq(tutoringSessionsTable.tutorId, req.user.id),
          eq(tutoringSessionsTable.studentId, studentId as string),
        ))
        .orderBy(desc(tutoringSessionsTable.scheduledAt));
    } else {
      sessions = await db
        .select()
        .from(tutoringSessionsTable)
        .where(eq(tutoringSessionsTable.tutorId, req.user.id))
        .orderBy(desc(tutoringSessionsTable.scheduledAt));
    }
  } else if (req.user.role === "parent") {
    // Parents see the sessions of their linked children.
    const links = await db
      .select({ studentId: parentStudentLinksTable.studentId })
      .from(parentStudentLinksTable)
      .where(and(
        eq(parentStudentLinksTable.parentId, req.user.id),
        eq(parentStudentLinksTable.status, "approved"),
        isNotNull(parentStudentLinksTable.studentId),
      ));
    const childIds = links.map((l) => l.studentId).filter((v): v is string => Boolean(v));
    // Include the parent's own id: a parent who books for a young child as
    // themselves (no separate child account) should see those sessions too.
    const ids = Array.from(new Set([req.user.id, ...childIds]));
    sessions = await db
      .select()
      .from(tutoringSessionsTable)
      .where(inArray(tutoringSessionsTable.studentId, ids))
      .orderBy(desc(tutoringSessionsTable.scheduledAt));
  } else {
    // students see their own sessions
    sessions = await db
      .select()
      .from(tutoringSessionsTable)
      .where(eq(tutoringSessionsTable.studentId, req.user.id))
      .orderBy(desc(tutoringSessionsTable.scheduledAt));
  }

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = sessions.map((s) => {
    const student = userMap.get(s.studentId);
    return {
      ...s,
      studentName: student
        ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.username || "Student"
        : "Unknown",
    };
  });

  res.json(ListSessionsResponse.parse(result));
});

router.post("/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const { scheduledAt, durationMinutes, topic, notes } = parsed.data;

  const tutorId = req.user.role === "tutor" ? req.user.id : req.user.tutorId ?? null;

  const [session] = await db
    .insert(tutoringSessionsTable)
    .values({
      tutorId,
      studentId: req.user.id,
      scheduledAt: new Date(scheduledAt),
      durationMinutes,
      topic: topic ?? null,
      notes: notes ?? null,
      status: "pending",
    })
    .returning();

  const student = await db.select().from(usersTable).where(eq(usersTable.id, session.studentId)).then(r => r[0]);
  const studentName = student
    ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.username || "Student"
    : "Unknown";

  res.status(201).json({ ...session, studentName });
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [session] = await db.select().from(tutoringSessionsTable).where(eq(tutoringSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const isTutor = req.user.role === "tutor" && session.tutorId === req.user.id;
  const isStudent = session.studentId === req.user.id;
  if (!isTutor && !isStudent) { res.status(403).json({ error: "Forbidden" }); return; }

  const student = await db.select().from(usersTable).where(eq(usersTable.id, session.studentId)).then(r => r[0]);
  const studentName = student
    ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.username || "Student"
    : "Unknown";

  res.json({ ...session, studentName });
});

router.patch("/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [existing] = await db.select().from(tutoringSessionsTable).where(eq(tutoringSessionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Session not found" }); return; }

  const isTutor = req.user.role === "tutor" && existing.tutorId === req.user.id;
  const isStudent = existing.studentId === req.user.id;
  if (!isTutor && !isStudent) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = UpdateSessionInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  // Approving, completing and writing lesson notes are the tutor's job. The
  // student can only cancel or reschedule their own session.
  if (!isTutor) {
    if (parsed.data.status !== undefined && parsed.data.status !== "cancelled") {
      res.status(403).json({ error: "Only your tutor can change a session to that status" });
      return;
    }
    if (parsed.data.notes !== undefined) {
      res.status(403).json({ error: "Only your tutor can edit lesson notes" });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.scheduledAt !== undefined) updates.scheduledAt = new Date(parsed.data.scheduledAt);

  const [updated] = await db
    .update(tutoringSessionsTable)
    .set(updates)
    .where(eq(tutoringSessionsTable.id, id))
    .returning();

  // Apply the refund policy the first time a session is cancelled.
  let cancellation = undefined;
  if (updates.status === "cancelled" && existing.status !== "cancelled") {
    cancellation = await applyCancellation(updated, req.user.role);
  }

  const student = await db.select().from(usersTable).where(eq(usersTable.id, updated.studentId)).then(r => r[0]);
  const studentName = student
    ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.username || "Student"
    : "Unknown";

  res.json({ ...updated, studentName, cancellation });
});

router.delete("/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [existing] = await db.select().from(tutoringSessionsTable).where(eq(tutoringSessionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Session not found" }); return; }

  const isTutor = req.user.role === "tutor" && existing.tutorId === req.user.id;
  const isStudent = existing.studentId === req.user.id;
  if (!isTutor && !isStudent) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(tutoringSessionsTable).where(eq(tutoringSessionsTable.id, id));
  res.json(DeleteSessionResponse.parse({ success: true }));
});

export default router;
