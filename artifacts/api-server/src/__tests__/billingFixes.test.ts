// Guards against ways a family could be billed wrongly: halving a bill by
// cancelling after the lesson, being charged for a request the tutor never
// approved, and being left owing for a session the tutor deleted.
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
const paymentsRouter = (await import("../routes/payments")).default;

beforeEach(() => fakeDb.reset());

const session = (over: Record<string, unknown>) => ({
  id: 3,
  tutorId: tutorA.id,
  studentId: studentA.id,
  status: "approved",
  durationMinutes: 60,
  scheduledAt: new Date(Date.now() - 48 * 3_600_000),
  topic: null,
  ...over,
});

describe("a family cancelling a session", () => {
  it("is refused once the session is completed", async () => {
    fakeDb.queue([session({ status: "completed" })]);
    const res = await request(testApp(sessionsRouter, studentA))
      .patch("/api/sessions/3").send({ status: "cancelled" });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toHaveLength(0);
  });

  it("is refused once the session's start time has passed", async () => {
    fakeDb.queue([session({})]);
    const res = await request(testApp(sessionsRouter, studentA))
      .patch("/api/sessions/3").send({ status: "cancelled" });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toHaveLength(0);
  });

  it("still works before the session starts", async () => {
    const upcoming = session({ scheduledAt: new Date(Date.now() + 72 * 3_600_000) });
    fakeDb.queue(
      [upcoming], // session lookup
      [{ ...upcoming, status: "cancelled" }], // update
      [], // release slot
      [{ id: tutorA.id, hourlyRate: 80 }], // billing: tutor
      [{ id: 1 }], // billing: free session is an earlier one
      [], // billing: no charge yet
      [{ id: studentA.id }], // student name
    );
    const res = await request(testApp(sessionsRouter, studentA))
      .patch("/api/sessions/3").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.cancellation.policy).toBe("full_refund");
  });
});

describe("creating charges for past sessions", () => {
  it("doesn't bill a request the tutor never approved", async () => {
    fakeDb.queue([session({ status: "pending" })], []);
    const res = await request(testApp(paymentsRouter, studentA)).get("/api/payments");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toHaveLength(0);
  });

  it("bills an approved session", async () => {
    fakeDb.queue(
      [session({})], // student's sessions
      [], // no existing charges
      [{ id: tutorA.id, hourlyRate: 80 }], // tutor
      [{ id: 1 }], // free session is an earlier one
      [], // insert
      [], // student's charges
    );
    const res = await request(testApp(paymentsRouter, studentA)).get("/api/payments");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["insert"]);
    expect(fakeDb.payloads[0]).toEqual([expect.objectContaining({ sessionId: 3, amount: 80, status: "due" })]);
  });
});

describe("a tutor deleting a session", () => {
  /** Queue a delete up to and including the lookup of the session's charge. */
  function queueDelete(charge: unknown[]) {
    fakeDb.queue(
      [session({})], // session lookup
      [], // delete
      [], // release slot
      charge, // the session's charge
    );
  }

  it("voids its unpaid charge", async () => {
    queueDelete([{ id: 12, sessionId: 3, amount: 80, status: "due", description: "Tutoring session" }]);
    const res = await request(testApp(sessionsRouter, tutorA)).delete("/api/sessions/3");
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[1]).toMatchObject({ amount: 0, status: "void" });
  });

  it("leaves a paid charge alone", async () => {
    queueDelete([{ id: 12, sessionId: 3, amount: 80, status: "received", description: "Tutoring session" }]);
    const res = await request(testApp(sessionsRouter, tutorA)).delete("/api/sessions/3");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete", "update"]); // just the slot release
  });

  it("moves the free credit on when the free session is deleted", async () => {
    queueDelete([{ id: 10, sessionId: 3, amount: 0, status: "received", description: "First session, free" }]);
    fakeDb.queue(
      [], // void the free charge
      [{ id: 4 }], // free session is now session 4
      [{ id: 13, sessionId: 4, amount: 80, status: "due", description: "Tutoring session" }],
    );
    const res = await request(testApp(sessionsRouter, tutorA)).delete("/api/sessions/3");
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[1]).toMatchObject({ amount: 0, status: "void" });
    expect(fakeDb.payloads[2]).toMatchObject({ amount: 0, status: "received", description: "First session, free" });
  });
});
