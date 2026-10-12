// Regression tests for the scheduling, billing and assignment bugs found by
// the test harness review (the "Bugs families would hit today" list).
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, studentA, studentB, type TestUser } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const sessionsRouter = (await import("../routes/sessions")).default;
const availabilityRouter = (await import("../routes/availability")).default;
const paymentsRouter = (await import("../routes/payments")).default;
const assignmentsRouter = (await import("../routes/assignments")).default;

beforeEach(() => fakeDb.reset());

const parentA = { id: "parent-a", role: "parent", tutorId: tutorA.id } as unknown as TestUser;
const inTwoDays = () => new Date(Date.now() + 48 * 3_600_000);
const inTwoHours = () => new Date(Date.now() + 2 * 3_600_000);

const session = (over: Record<string, unknown> = {}) => ({
  id: 1,
  tutorId: tutorA.id,
  studentId: studentA.id,
  status: "approved",
  durationMinutes: 60,
  scheduledAt: inTwoDays(),
  ...over,
});

describe("time slots follow their session", () => {
  it("reopens the slot when a session is cancelled", async () => {
    const s = session();
    fakeDb.queue(
      [s], // session lookup
      [{ ...s, status: "cancelled" }], // update
      [], // release slot
      [{ id: tutorA.id, hourlyRate: 80 }], // billing: tutor
      [], // billing: free session
      [], // billing: existing charge
      [{ id: studentA.id, firstName: "Sam" }],
    );
    const res = await request(testApp(sessionsRouter, studentA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[1]).toEqual({ isBooked: "false", bookedByStudentId: null, sessionId: null });
  });

  it("refuses a family reschedule to a time that isn't an open slot", async () => {
    fakeDb.queue([session()], []); // no open slot at that time
    const res = await request(testApp(sessionsRouter, studentA))
      .patch("/api/sessions/1")
      .send({ scheduledAt: "2026-12-01T15:00:00.000Z" });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets the tutor move a session anywhere, and frees the old slot", async () => {
    const s = session();
    fakeDb.queue([s], [], [{ ...s }], [], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, tutorA))
      .patch("/api/sessions/1")
      .send({ scheduledAt: "2026-12-01T15:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["update", "update"]);
    expect(fakeDb.payloads[1]).toMatchObject({ isBooked: "false", sessionId: null });
  });

  it("won't reschedule a cancelled session", async () => {
    fakeDb.queue([session({ status: "cancelled" })]);
    const res = await request(testApp(sessionsRouter, tutorA))
      .patch("/api/sessions/1")
      .send({ scheduledAt: "2026-12-01T15:00:00.000Z" });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("deleting a session", () => {
  it("is tutor-only, so families go through cancellation and its late fee", async () => {
    fakeDb.queue([session()]);
    const res = await request(testApp(sessionsRouter, studentA)).delete("/api/sessions/1");
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("late cancellation fee", () => {
  it("charges half price even when the cancelled booking was the student's first", async () => {
    const s = session({ scheduledAt: inTwoHours() });
    fakeDb.queue(
      [s],
      [{ ...s, status: "cancelled" }],
      [], // release slot
      [{ id: tutorA.id, hourlyRate: 80 }],
      [], // no attended (non-cancelled) session yet, so this one isn't the free one
      [], // no charge yet
      [], // insert fee
      [{ id: studentA.id }],
    );
    const res = await request(testApp(sessionsRouter, studentA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.cancellation).toEqual({ policy: "half_fee", feeOwed: 40, refundOwed: 0 });
    expect(fakeDb.payloads.at(-1)).toMatchObject({ amount: 40, studentId: studentA.id, status: "due" });
  });
});

describe("parents act for their linked child", () => {
  it("can read their child's session", async () => {
    fakeDb.queue([session()], [{ studentId: studentA.id }], [{ id: studentA.id, firstName: "Sam" }]);
    const res = await request(testApp(sessionsRouter, parentA)).get("/api/sessions/1");
    expect(res.status).toBe(200);
  });

  it("can cancel their child's session", async () => {
    const s = session();
    fakeDb.queue(
      [s],
      [{ studentId: studentA.id }], // links
      [{ ...s, status: "cancelled" }],
      [],
      [{ id: tutorA.id, hourlyRate: 80 }],
      [],
      [],
      [{ id: studentA.id }],
    );
    const res = await request(testApp(sessionsRouter, parentA)).patch("/api/sessions/1").send({ status: "cancelled" });
    expect(res.status).toBe(200);
  });

  it("can't read a session of a child they aren't linked to", async () => {
    fakeDb.queue([session({ studentId: studentB.id })], [{ studentId: studentA.id }]);
    const res = await request(testApp(sessionsRouter, parentA)).get("/api/sessions/1");
    expect(res.status).toBe(403);
  });

  const slot = { id: 9, tutorId: tutorA.id, startsAt: inTwoDays(), durationMinutes: 60, isBooked: "false", topic: null };

  it("files a booking under their only child", async () => {
    fakeDb.queue([slot], [{ studentId: studentA.id }], [session()], []);
    const res = await request(testApp(availabilityRouter, parentA)).post("/api/availability/9/book").send({});
    expect(res.status).toBe(201);
    expect(fakeDb.payloads[0]).toMatchObject({ studentId: studentA.id });
    expect(fakeDb.payloads[1]).toMatchObject({ isBooked: "true", bookedByStudentId: studentA.id });
  });

  it("asks which child when they have several", async () => {
    fakeDb.queue([slot], [{ studentId: studentA.id }, { studentId: studentB.id }]);
    const res = await request(testApp(availabilityRouter, parentA)).post("/api/availability/9/book").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CHOOSE_CHILD");
    expect(fakeDb.writes()).toEqual([]);
  });

  it("can't book for a child they aren't linked to", async () => {
    fakeDb.queue([slot], [{ studentId: studentA.id }]);
    const res = await request(testApp(availabilityRouter, parentA))
      .post("/api/availability/9/book")
      .send({ studentId: studentB.id });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("sees their child's submission and the tutor's review", async () => {
    const sub = { id: 3, assignmentId: 7, studentId: studentA.id, content: "answers", tutorComment: "Nice" };
    fakeDb.queue([{ id: 7, tutorId: tutorA.id, assignedTo: studentA.id }], [{ studentId: studentA.id }], [sub]);
    const res = await request(testApp(assignmentsRouter, parentA)).get("/api/assignments/7/my-submission");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ content: "answers", tutorComment: "Nice" });
  });
});

describe("payments", () => {
  it("won't let a family flip a confirmed payment back to sent", async () => {
    fakeDb.queue([{ id: 5, studentId: studentA.id, tutorId: tutorA.id, status: "received", amount: 80 }]);
    const res = await request(testApp(paymentsRouter, studentA)).post("/api/payments/5/mark-sent");
    expect(res.status).toBe(409);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("still lets a family mark a due charge as sent", async () => {
    fakeDb.queue([{ id: 5, studentId: studentA.id, tutorId: tutorA.id, status: "due", amount: 80 }], [{ id: 5 }]);
    const res = await request(testApp(paymentsRouter, studentA)).post("/api/payments/5/mark-sent");
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[0]).toMatchObject({ status: "sent" });
  });
});

describe("assignments", () => {
  it("deleting one also removes its submissions and attached files", async () => {
    fakeDb.queue([{ id: 7, tutorId: tutorA.id }]);
    const res = await request(testApp(assignmentsRouter, tutorA)).delete("/api/assignments/7");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete", "delete", "delete"]);
  });

  it("returns 404 when deleting one that doesn't exist", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(assignmentsRouter, tutorA)).delete("/api/assignments/99");
    expect(res.status).toBe(404);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("POST /sessions", () => {
  it("accepts an ISO date string", async () => {
    fakeDb.queue([session({ status: "pending" })], [{ id: studentA.id }]);
    const res = await request(testApp(sessionsRouter, studentA))
      .post("/api/sessions")
      .send({ scheduledAt: "2026-12-01T15:00:00.000Z", durationMinutes: 60 });
    expect(res.status).toBe(201);
    expect(fakeDb.payloads[0]).toMatchObject({ scheduledAt: new Date("2026-12-01T15:00:00.000Z") });
  });
});
