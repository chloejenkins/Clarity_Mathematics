import { Router, type IRouter, type Request, type Response } from "express";
import { db, tutoringSessionsTable, usersTable, parentStudentLinksTable } from "@workspace/db";
import { eq, desc, and, inArray, isNotNull } from "drizzle-orm";
import {
  ListSessionsResponse,
  DeleteSessionResponse,
} from "@workspace/api-zod";
import { applyCancellation } from "../lib/billing";
import { isSelfOrLinkedParent } from "../lib/family";
import { releaseSlotForSession, findOpenSlot, bookSlot } from "../lib/slots";
import { z } from "zod";

// The generated CreateSessionBody expects a Date object for scheduledAt, which
// a JSON body can never contain, so every request failed validation. Accept
// the ISO string the spec describes instead.
const CreateSessionInput = z.object({
  scheduledAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  durationMinutes: z.number().int().min(15).max(240),
  topic: z.string().optional(),
  notes: z.string().optional(),
});

type SessionRow = typeof tutoringSessionsTable.$inferSelect;

/**
 * How the caller relates to a session: its tutor, the family side (the
 * student or a parent linked to them), or neither.
 */
async function sessionAccess(user: Express.User, session: SessionRow): Promise<"tutor" | "family" | null> {
  if (user.role === "tutor") return session.tutorId === user.id ? "tutor" : null;
  return (await isSelfOrLinkedParent(user, session.studentId)) ? "family" : null;
}

const UpdateSessionInput = z.object({
  status: z.enum(["pending", "approved", "cancelled", "completed"]).optional(),
  noShow: z.boolean().optional(), // tutor only, with status "cancelled": charge the 50% fee
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

  const parsed = CreateSessionInput.safeParse(req.body);
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

  if (!(await sessionAccess(req.user, session))) { res.status(403).json({ error: "Forbidden" }); return; }

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

  const access = await sessionAccess(req.user, existing);
  if (!access) { res.status(403).json({ error: "Forbidden" }); return; }
  const isTutor = access === "tutor";

  const parsed = UpdateSessionInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const noShow = parsed.data.noShow === true;
  if (noShow) {
    if (!isTutor) {
      res.status(403).json({ error: "Only your tutor can mark a no-show" });
      return;
    }
    if (parsed.data.status !== "cancelled" || existing.status !== "approved") {
      res.status(400).json({ error: "Only a booked session can be marked as a no-show" });
      return;
    }
  }

  // Approving, completing and writing lesson notes are the tutor's job. The
  // student (or their parent) can only cancel or reschedule the session.
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

  // Rescheduling moves the session out of its old slot. The family can only
  // move it into one of the tutor's open slots; the tutor can pick any time,
  // and takes the open slot at that time if there is one.
  let newSlot: Awaited<ReturnType<typeof findOpenSlot>> = undefined;
  if (parsed.data.scheduledAt !== undefined) {
    const newTime = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(newTime.getTime())) { res.status(400).json({ error: "Invalid date" }); return; }
    if (existing.status === "cancelled" || existing.status === "completed") {
      res.status(400).json({ error: "A cancelled or completed session can't be rescheduled" });
      return;
    }
    if (newTime.getTime() !== new Date(existing.scheduledAt).getTime()) {
      newSlot = await findOpenSlot(existing.tutorId, newTime);
      if (!isTutor && !newSlot) {
        res.status(400).json({ error: "Pick one of your tutor's open times" });
        return;
      }
      updates.scheduledAt = newTime;
      if (newSlot) updates.durationMinutes = newSlot.durationMinutes;
    }
  }

  if (Object.keys(updates).length === 0) {
    updates.updatedAt = new Date();
  }

  const [updated] = await db
    .update(tutoringSessionsTable)
    .set(updates)
    .where(eq(tutoringSessionsTable.id, id))
    .returning();

  if (updates.scheduledAt !== undefined) {
    await releaseSlotForSession(id);
    if (newSlot) await bookSlot(newSlot.id, id, existing.studentId);
  }

  // Apply the refund policy the first time a session is cancelled, and give
  // its time back to the open list.
  let cancellation = undefined;
  if (updates.status === "cancelled" && existing.status !== "cancelled") {
    await releaseSlotForSession(id);
    cancellation = await applyCancellation(updated, req.user.role, noShow);
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

  const access = await sessionAccess(req.user, existing);
  if (!access) { res.status(403).json({ error: "Forbidden" }); return; }
  // Families cancel instead, so the late-cancellation policy applies and the
  // tutor keeps a record. Deleting is the tutor's clean-up tool.
  if (access !== "tutor") {
    res.status(403).json({ error: "Cancel the session instead" });
    return;
  }

  await db.delete(tutoringSessionsTable).where(eq(tutoringSessionsTable.id, id));
  await releaseSlotForSession(id);
  res.json(DeleteSessionResponse.parse({ success: true }));
});

export default router;
