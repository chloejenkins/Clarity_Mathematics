import { Router, type IRouter, type Request, type Response } from "express";
import { db, tutoringSessionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListSessionsResponse,
  CreateSessionBody,
  UpdateSessionBody,
  DeleteSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { studentId } = req.query;

  let sessions;
  if (req.user.role === "tutor") {
    if (studentId) {
      sessions = await db
        .select()
        .from(tutoringSessionsTable)
        .where(eq(tutoringSessionsTable.studentId, studentId as string))
        .orderBy(desc(tutoringSessionsTable.scheduledAt));
    } else {
      sessions = await db
        .select()
        .from(tutoringSessionsTable)
        .orderBy(desc(tutoringSessionsTable.scheduledAt));
    }
  } else {
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
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { scheduledAt, durationMinutes, topic, notes } = parsed.data;

  const [session] = await db
    .insert(tutoringSessionsTable)
    .values({
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
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Number(req.params.id);
  const [session] = await db
    .select()
    .from(tutoringSessionsTable)
    .where(eq(tutoringSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (req.user.role !== "tutor" && session.studentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const student = await db.select().from(usersTable).where(eq(usersTable.id, session.studentId)).then(r => r[0]);
  const studentName = student
    ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.username || "Student"
    : "Unknown";

  res.json({ ...session, studentName });
});

router.patch("/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(tutoringSessionsTable)
    .where(eq(tutoringSessionsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (req.user.role !== "tutor" && existing.studentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
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

  const student = await db.select().from(usersTable).where(eq(usersTable.id, updated.studentId)).then(r => r[0]);
  const studentName = student
    ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.username || "Student"
    : "Unknown";

  res.json({ ...updated, studentName });
});

router.delete("/sessions/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(tutoringSessionsTable)
    .where(eq(tutoringSessionsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (req.user.role !== "tutor" && existing.studentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(tutoringSessionsTable).where(eq(tutoringSessionsTable.id, id));
  res.json(DeleteSessionResponse.parse({ success: true }));
});

export default router;
