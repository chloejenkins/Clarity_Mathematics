import { db, availabilitySlotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Put the availability slot a session was booked into back on the open list,
 * so a cancelled, moved or deleted session doesn't strand the tutor's time.
 */
export async function releaseSlotForSession(sessionId: number): Promise<void> {
  await db
    .update(availabilitySlotsTable)
    .set({ isBooked: "false", bookedByStudentId: null, sessionId: null })
    .where(eq(availabilitySlotsTable.sessionId, sessionId));
}

/** The tutor's open (unbooked) slot starting exactly at `startsAt`, if any. */
export async function findOpenSlot(
  tutorId: string | null,
  startsAt: Date,
): Promise<typeof availabilitySlotsTable.$inferSelect | undefined> {
  if (!tutorId) return undefined;
  const [slot] = await db
    .select()
    .from(availabilitySlotsTable)
    .where(and(
      eq(availabilitySlotsTable.tutorId, tutorId),
      eq(availabilitySlotsTable.startsAt, startsAt),
      eq(availabilitySlotsTable.isBooked, "false"),
    ))
    .limit(1);
  return slot;
}

/** Mark a slot as taken by a session. */
export async function bookSlot(slotId: number, sessionId: number, studentId: string): Promise<void> {
  await db
    .update(availabilitySlotsTable)
    .set({ isBooked: "true", bookedByStudentId: studentId, sessionId })
    .where(eq(availabilitySlotsTable.id, slotId));
}
