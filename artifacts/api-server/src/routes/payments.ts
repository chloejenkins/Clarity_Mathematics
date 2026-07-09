import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, paymentsTable, tutoringSessionsTable, usersTable, parentStudentLinksTable } from "@workspace/db";
import { eq, and, inArray, desc, asc, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const DEFAULT_RATE = 40;

type UserRow = typeof usersTable.$inferSelect;
type SessionRow = typeof tutoringSessionsTable.$inferSelect;
type PaymentRow = typeof paymentsTable.$inferSelect;

function displayName(u: UserRow | undefined): string {
  if (!u) return "Unknown";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || u.email || "User";
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

/** Student ids of a parent's linked children. */
async function linkedStudentIds(parentId: string): Promise<string[]> {
  const links = await db
    .select({ studentId: parentStudentLinksTable.studentId })
    .from(parentStudentLinksTable)
    .where(and(eq(parentStudentLinksTable.parentId, parentId), isNotNull(parentStudentLinksTable.studentId)));
  return links.map((l) => l.studentId).filter((v): v is string => Boolean(v));
}

/**
 * Ensure a payment row exists for each past, non-cancelled session in the set.
 * Idempotent — only creates charges that don't exist yet. The student's earliest
 * session is free (matches the "first session free" policy).
 */
async function ensurePayments(sessions: SessionRow[]) {
  const now = Date.now();
  const billable = sessions.filter(
    (s) => s.studentId && s.scheduledAt && new Date(s.scheduledAt).getTime() < now && s.status !== "cancelled",
  );
  if (billable.length === 0) return;

  const have = new Set(
    (
      await db
        .select({ sessionId: paymentsTable.sessionId })
        .from(paymentsTable)
        .where(inArray(paymentsTable.sessionId, billable.map((s) => s.id)))
    ).map((r) => r.sessionId),
  );
  const missing = billable.filter((s) => !have.has(s.id));
  if (missing.length === 0) return;

  // Single-tutor resolution: fall back to the first tutor + their rate.
  const [tutor] = await db.select().from(usersTable).where(eq(usersTable.role, "tutor")).limit(1);
  if (!tutor) return; // no tutor to bill on behalf of
  const rate = tutor.hourlyRate ?? DEFAULT_RATE;

  // Earliest session per student → free.
  const firstByStudent = new Map<string, number>();
  for (const sid of new Set(missing.map((s) => s.studentId))) {
    const [earliest] = await db
      .select()
      .from(tutoringSessionsTable)
      .where(eq(tutoringSessionsTable.studentId, sid))
      .orderBy(asc(tutoringSessionsTable.scheduledAt))
      .limit(1);
    if (earliest) firstByStudent.set(sid, earliest.id);
  }

  const rows = missing.map((s) => {
    const isFirst = firstByStudent.get(s.studentId) === s.id;
    const amount = isFirst ? 0 : Math.max(0, Math.round(((s.durationMinutes ?? 60) / 60) * rate));
    return {
      tutorId: s.tutorId ?? tutor.id,
      studentId: s.studentId,
      sessionId: s.id,
      amount,
      description: isFirst ? "First session — free" : (s.topic || "Tutoring session"),
      status: amount === 0 ? "received" : "due",
      receivedAt: amount === 0 ? new Date() : null,
    };
  });
  await db.insert(paymentsTable).values(rows);
}

async function hydrate(rows: PaymentRow[]) {
  if (rows.length === 0) return [];
  const [users, sessions] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(tutoringSessionsTable),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  return rows.map((p) => ({
    id: p.id,
    amount: p.amount,
    description: p.description,
    status: p.status,
    refundDue: p.refundDue,
    studentId: p.studentId,
    studentName: displayName(userMap.get(p.studentId)),
    tutorName: displayName(userMap.get(p.tutorId)),
    sessionDate: p.sessionId ? sessionMap.get(p.sessionId)?.scheduledAt ?? null : null,
    createdAt: p.createdAt,
    sentAt: p.sentAt,
    receivedAt: p.receivedAt,
  }));
}

// GET /payments — reconciles then returns the caller's charges.
router.get("/payments", requireAuth, async (req: Request, res: Response) => {
  if (req.user.role === "tutor") {
    const sessions = await db.select().from(tutoringSessionsTable);
    await ensurePayments(sessions);
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.tutorId, req.user.id))
      .orderBy(desc(paymentsTable.createdAt));
    res.json(await hydrate(rows));
  } else if (req.user.role === "parent") {
    // Parents see (and can pay) their linked children's charges — plus their
    // own, for a parent acting as the family account for a young child.
    const ids = Array.from(new Set([req.user.id, ...(await linkedStudentIds(req.user.id))]));
    const sessions = await db
      .select()
      .from(tutoringSessionsTable)
      .where(inArray(tutoringSessionsTable.studentId, ids));
    await ensurePayments(sessions);
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(inArray(paymentsTable.studentId, ids))
      .orderBy(desc(paymentsTable.createdAt));
    res.json(await hydrate(rows));
  } else {
    const sessions = await db
      .select()
      .from(tutoringSessionsTable)
      .where(eq(tutoringSessionsTable.studentId, req.user.id));
    await ensurePayments(sessions);
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.studentId, req.user.id))
      .orderBy(desc(paymentsTable.createdAt));
    res.json(await hydrate(rows));
  }
});

// Student marks a charge as paid (sent) → awaits tutor confirmation.
router.post("/payments/:id/mark-sent", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  const allowed =
    p.studentId === req.user.id ||
    (req.user.role === "parent" && (await linkedStudentIds(req.user.id)).includes(p.studentId));
  if (!allowed) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db
    .update(paymentsTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(paymentsTable.id, id))
    .returning();
  res.json(updated);
});

// Tutor confirms a payment was received.
router.post("/payments/:id/mark-received", requireAuth, async (req: Request, res: Response) => {
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Tutors only" }); return; }
  const id = Number(req.params.id);
  const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  if (p.tutorId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db
    .update(paymentsTable)
    .set({ status: "received", receivedAt: new Date() })
    .where(eq(paymentsTable.id, id))
    .returning();
  res.json(updated);
});

// Tutor confirms they've sent a refund back to the student.
router.post("/payments/:id/mark-refunded", requireAuth, async (req: Request, res: Response) => {
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Tutors only" }); return; }
  const id = Number(req.params.id);
  const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  if (p.tutorId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db
    .update(paymentsTable)
    .set({ status: "refunded", refundDue: 0 })
    .where(eq(paymentsTable.id, id))
    .returning();
  res.json(updated);
});

// Tutor rate settings.
router.get("/payments/settings", requireAuth, async (req: Request, res: Response) => {
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
  res.json({ hourlyRate: me?.hourlyRate ?? DEFAULT_RATE });
});

const RateBody = z.object({ hourlyRate: z.number().int().min(0).max(100000) });
router.put("/payments/settings", requireAuth, async (req: Request, res: Response) => {
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Tutors only" }); return; }
  const parsed = RateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "hourlyRate must be a whole number" }); return; }
  await db
    .update(usersTable)
    .set({ hourlyRate: parsed.data.hourlyRate })
    .where(eq(usersTable.id, req.user.id));
  res.json({ hourlyRate: parsed.data.hourlyRate });
});

export default router;
