// The first session is free. When the session holding that credit is
// cancelled (including "It was cancelled" after it was already billed), the
// credit moves to the student's next session.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, studentA } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const sessionsRouter = (await import("../routes/sessions")).default;

beforeEach(() => fakeDb.reset());

const twoDaysAgo = () => new Date(Date.now() - 48 * 3_600_000);
const inTwoHours = () => new Date(Date.now() + 2 * 3_600_000);

const first = {
  id: 1,
  tutorId: tutorA.id,
  studentId: studentA.id,
  status: "approved",
  durationMinutes: 60,
  scheduledAt: twoDaysAgo(),
};
const freeCharge = { id: 10, sessionId: 1, amount: 0, status: "received", description: "First session, free" };
const nextCharge = (over: Record<string, unknown>) => ({
  id: 11, sessionId: 2, amount: 80, status: "due", description: "Tutoring session", ...over,
});

/** Queue the lookups of a session cancel up to and including its existing charge. */
function queueCancel(session: typeof first, charge: unknown) {
  fakeDb.queue(
    [session], // session lookup
    [{ ...session, status: "cancelled" }], // update
    [], // release slot
    [{ id: tutorA.id, hourlyRate: 80 }], // billing: tutor
    [{ id: 2 }], // billing: free session is now session 2
    [charge], // billing: existing charge for the cancelled session
  );
}

describe("moving the free first session", () => {
  it("voids the free charge and makes the next session's unpaid charge free", async () => {
    queueCancel(first, freeCharge);
    fakeDb.queue([], [{ id: 2 }], [nextCharge({})], [], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.cancellation).toEqual({ policy: "tutor_cancel", feeOwed: 0, refundOwed: 0 });
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 0, status: "void" });
    expect(fakeDb.payloads[3]).toMatchObject({ amount: 0, status: "received", description: "First session, free" });
  });

  it("turns an already-paid next session into a refund", async () => {
    queueCancel(first, freeCharge);
    fakeDb.queue([], [{ id: 2 }], [nextCharge({ status: "received" })], [], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[3]).toMatchObject({ amount: 0, status: "refund_due", refundDue: 80 });
  });

  it("leaves things alone when the next session hasn't been billed yet", async () => {
    queueCancel(first, freeCharge);
    fakeDb.queue([], [{ id: 2 }], [], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads).toHaveLength(3); // session, slot, void free charge
  });

  it("charges a late fee as due, not as already paid, when the student cancels their free session late", async () => {
    const soon = { ...first, scheduledAt: inTwoHours() };
    queueCancel(soon, freeCharge);
    fakeDb.queue([], [], [], [{ id: studentA.id }]); // fee update, no next session
    const res = await request(testApp(sessionsRouter, studentA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.cancellation).toEqual({ policy: "half_fee", feeOwed: 40, refundOwed: 0 });
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 40, status: "due", receivedAt: null });
  });

  it("doesn't touch other charges when an ordinary session is cancelled", async () => {
    queueCancel({ ...first, id: 3 }, nextCharge({ id: 12, sessionId: 3 }));
    fakeDb.queue([], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA)).patch("/api/sessions/3").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 0, status: "void" });
    expect(fakeDb.payloads).toHaveLength(3);
  });
});
