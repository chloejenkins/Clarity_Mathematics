import { db, paymentsTable, tutoringSessionsTable, usersTable } from "@workspace/db";
import { eq, ne, and, asc } from "drizzle-orm";

const DEFAULT_RATE = 40;

type SessionRow = typeof tutoringSessionsTable.$inferSelect;

export interface CancellationOutcome {
  policy: "full_refund" | "half_fee" | "tutor_cancel";
  feeOwed: number; // what the student still owes as a cancellation fee
  refundOwed: number; // what the tutor should refund (if the student had already paid)
}

/**
 * The id of a student's free first session: their earliest session that
 * wasn't cancelled. A cancelled booking never uses up the free session.
 */
export async function freeSessionId(studentId: string): Promise<number | undefined> {
  const [earliest] = await db
    .select({ id: tutoringSessionsTable.id })
    .from(tutoringSessionsTable)
    .where(and(
      eq(tutoringSessionsTable.studentId, studentId),
      ne(tutoringSessionsTable.status, "cancelled"),
    ))
    .orderBy(asc(tutoringSessionsTable.scheduledAt))
    .limit(1);
  return earliest?.id;
}

export const FREE_SESSION_DESCRIPTION = "First session, free";

type PaymentRow = typeof paymentsTable.$inferSelect;

function isFreeSessionCharge(p: PaymentRow): boolean {
  return p.amount === 0 && p.description === FREE_SESSION_DESCRIPTION;
}

/**
 * After the session holding a student's free credit is cancelled, make their
 * new earliest session the free one. If it hasn't been charged yet, nothing
 * to do: it is billed as free when its charge is created. If it was charged
 * and is unpaid, the charge drops to $0; if it was already paid (or marked
 * sent), the amount becomes a refund to send back.
 */
async function moveFreeCredit(studentId: string): Promise<void> {
  const nextFree = await freeSessionId(studentId);
  if (nextFree === undefined) return;
  const [charge] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.sessionId, nextFree))
    .limit(1);
  if (!charge || isFreeSessionCharge(charge) || charge.amount === 0) return;

  if (charge.status === "due") {
    await db
      .update(paymentsTable)
      .set({ amount: 0, status: "received", receivedAt: new Date(), description: FREE_SESSION_DESCRIPTION })
      .where(eq(paymentsTable.id, charge.id));
  } else if (charge.status === "sent" || charge.status === "received") {
    await db
      .update(paymentsTable)
      .set({
        amount: 0,
        status: "refund_due",
        refundDue: charge.amount,
        description: `${FREE_SESSION_DESCRIPTION} (refund due)`,
      })
      .where(eq(paymentsTable.id, charge.id));
  }
}

/**
 * Apply the cancellation refund policy to a session's charge:
 *   - tutor cancels (any time)      → no fee (full refund)
 *   - student cancels > 24h before  → no fee (full refund)
 *   - student cancels ≤ 24h before  → 50% fee
 * If the student had already paid, records the refund amount to send back manually.
 */
export async function applyCancellation(
  session: SessionRow,
  cancelledByRole: string,
): Promise<CancellationOutcome> {
  const now = Date.now();
  const scheduled = session.scheduledAt ? new Date(session.scheduledAt).getTime() : now;
  const hoursUntil = (scheduled - now) / 3_600_000;

  const [tutor] = await db.select().from(usersTable).where(eq(usersTable.role, "tutor")).limit(1);
  const rate = tutor?.hourlyRate ?? DEFAULT_RATE;

  // First session is free. The session being cancelled is already marked
  // cancelled, so it can't be the free one: a late cancellation costs half
  // the normal price, and the free session moves to the next one attended.
  const isFirst = (await freeSessionId(session.studentId)) === session.id;
  const fullAmount = isFirst ? 0 : Math.max(0, Math.round(((session.durationMinutes ?? 60) / 60) * rate));

  let policy: CancellationOutcome["policy"];
  let fee: number;
  if (cancelledByRole === "tutor") {
    policy = "tutor_cancel";
    fee = 0;
  } else if (hoursUntil > 24) {
    policy = "full_refund";
    fee = 0;
  } else {
    policy = "half_fee";
    fee = Math.round(fullAmount * 0.5);
  }

  const [existing] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.sessionId, session.id))
    .limit(1);

  let feeOwed = 0;
  let refundOwed = 0;

  if (existing && isFreeSessionCharge(existing)) {
    // The free first session was cancelled. Nothing was paid for it, so charge
    // the fee (if any) in its place, and give the free credit to the student's
    // next session.
    await db
      .update(paymentsTable)
      .set(fee > 0
        ? { amount: fee, status: "due", receivedAt: null, description: "Late cancellation (50% fee)" }
        : { amount: 0, status: "void", description: "Cancelled (no charge)" })
      .where(eq(paymentsTable.id, existing.id));
    feeOwed = fee;
    await moveFreeCredit(session.studentId);
  } else if (existing && (existing.status === "received" || existing.status === "sent")) {
    // Student already paid (or claims to have) → refund the difference above the fee.
    refundOwed = Math.max(0, existing.amount - fee);
    await db
      .update(paymentsTable)
      .set({
        status: refundOwed > 0 ? "refund_due" : "received",
        refundDue: refundOwed,
        amount: fee,
        description:
          policy === "half_fee" ? "Late cancellation (50% fee)" : "Cancelled, refund due",
      })
      .where(eq(paymentsTable.id, existing.id));
  } else if (existing) {
    // Unpaid charge → reduce to the fee, or void it entirely.
    if (fee > 0) {
      await db
        .update(paymentsTable)
        .set({ amount: fee, status: "due", description: "Late cancellation (50% fee)" })
        .where(eq(paymentsTable.id, existing.id));
      feeOwed = fee;
    } else {
      await db
        .update(paymentsTable)
        .set({ amount: 0, status: "void", description: "Cancelled (no charge)" })
        .where(eq(paymentsTable.id, existing.id));
    }
  } else if (fee > 0) {
    // No charge yet (future session) → create the cancellation fee.
    const tutorId = session.tutorId ?? tutor?.id;
    if (tutorId) {
      await db.insert(paymentsTable).values({
        tutorId,
        studentId: session.studentId,
        sessionId: session.id,
        amount: fee,
        description: "Late cancellation (50% fee)",
        status: "due",
      });
      feeOwed = fee;
    }
  }

  return { policy, feeOwed, refundOwed };
}
