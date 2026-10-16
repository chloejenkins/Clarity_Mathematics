// A tutor can mark a past session as a no-show, which charges the 50%
// late-cancellation fee whatever the timing.
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

const past = {
  id: 3,
  tutorId: tutorA.id,
  studentId: studentA.id,
  status: "approved",
  durationMinutes: 60,
  scheduledAt: new Date(Date.now() - 48 * 3_600_000),
};

/** Queue a session cancel up to and including the lookup of its existing charge. */
function queueCancel(session: typeof past, charge: unknown[]) {
  fakeDb.queue(
    [session], // session lookup
    [{ ...session, status: "cancelled" }], // update
    [], // release slot
    [{ id: tutorA.id, hourlyRate: 80 }], // billing: tutor
    [{ id: 1 }], // billing: free session is an earlier one
    charge, // billing: existing charge for this session
  );
}

describe("marking a no-show", () => {
  it("cuts an unpaid charge to the 50% fee", async () => {
    queueCancel(past, [{ id: 12, sessionId: 3, amount: 80, status: "due", description: "Tutoring session" }]);
    fakeDb.queue([], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA))
      .patch("/api/sessions/3").send({ status: "cancelled", noShow: true });
    expect(res.status).toBe(200);
    expect(res.body.cancellation).toEqual({ policy: "no_show", feeOwed: 40, refundOwed: 0 });
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 40, status: "due", description: "No-show (50% fee)" });
  });

  it("creates the fee when the session hasn't been billed yet", async () => {
    queueCancel(past, []);
    fakeDb.queue([], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA))
      .patch("/api/sessions/3").send({ status: "cancelled", noShow: true });
    expect(res.status).toBe(200);
    expect(res.body.cancellation).toEqual({ policy: "no_show", feeOwed: 40, refundOwed: 0 });
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 40, status: "due", sessionId: 3, description: "No-show (50% fee)" });
  });

  it("refunds half when the family already paid", async () => {
    queueCancel(past, [{ id: 12, sessionId: 3, amount: 80, status: "received", description: "Tutoring session" }]);
    fakeDb.queue([], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA))
      .patch("/api/sessions/3").send({ status: "cancelled", noShow: true });
    expect(res.status).toBe(200);
    expect(res.body.cancellation).toEqual({ policy: "no_show", feeOwed: 0, refundOwed: 40 });
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 40, status: "refund_due", refundDue: 40 });
  });

  it("still charges nothing when the tutor says it was cancelled", async () => {
    queueCancel(past, [{ id: 12, sessionId: 3, amount: 80, status: "due", description: "Tutoring session" }]);
    fakeDb.queue([], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA)).patch("/api/sessions/3").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.cancellation.policy).toBe("tutor_cancel");
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 0, status: "void" });
  });

  it("only lets the tutor mark a no-show", async () => {
    fakeDb.queue([past]);
    const res = await request(testApp(sessionsRouter, studentA))
      .patch("/api/sessions/3").send({ status: "cancelled", noShow: true });
    expect(res.status).toBe(403);
    expect(fakeDb.payloads).toHaveLength(0);
  });

  it("refuses a no-show on a session that isn't booked", async () => {
    fakeDb.queue([{ ...past, status: "completed" }]);
    const res = await request(testApp(sessionsRouter, tutorA))
      .patch("/api/sessions/3").send({ status: "cancelled", noShow: true });
    expect(res.status).toBe(400);
    expect(fakeDb.payloads).toHaveLength(0);
  });
});
