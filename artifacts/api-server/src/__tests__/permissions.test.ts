import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, tutorB, studentA, studentB, type TestUser } from "./helpers/testApp";

// set-role reads the signed-in Clerk user directly rather than req.user.
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: "user_1" }),
  clerkClient: {
    users: {
      getUser: async () => ({
        username: null,
        firstName: "Pat",
        lastName: null,
        imageUrl: null,
        emailAddresses: [{ emailAddress: "pat@example.com" }],
      }),
      updateUserMetadata: async () => ({}),
    },
  },
}));

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const parentLinksRouter = (await import("../routes/parentLinks")).default;
const sessionsRouter = (await import("../routes/sessions")).default;
const assignmentsRouter = (await import("../routes/assignments")).default;
const messagesRouter = (await import("../routes/messages")).default;
const conversationsRouter = (await import("../routes/conversations")).default;

beforeEach(() => fakeDb.reset());

const parentA = { id: "parent-a", role: "parent", tutorId: null } as unknown as TestUser;

describe("parent links need approval", () => {
  const pendingLink = { id: 1, parentId: parentA.id, studentId: studentA.id, tutorId: tutorA.id, status: "pending" };

  it("creates a pending request, not a live link, when a parent enters a student's email", async () => {
    fakeDb.queue(
      [{ id: studentA.id, email: "sam@example.com", role: "student", tutorId: tutorA.id, firstName: "Sam" }], // users
      [], // no existing link
      [pendingLink], // insert
    );
    const res = await request(testApp(parentLinksRouter, parentA))
      .post("/api/parent-links")
      .send({ studentEmail: "sam@example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ linked: false, status: "pending" });
    expect(fakeDb.payloads[0]).toMatchObject({ parentId: parentA.id, studentId: studentA.id, status: "pending" });
  });

  it("does not use the parent's own tutor as the approving tutor", async () => {
    const parentWithTutor = { ...parentA, tutorId: tutorB.id } as TestUser;
    fakeDb.queue(
      [{ id: studentA.id, email: "sam@example.com", role: "student", tutorId: null }],
      [],
      [{ ...pendingLink, tutorId: null }],
    );
    await request(testApp(parentLinksRouter, parentWithTutor))
      .post("/api/parent-links")
      .send({ studentEmail: "sam@example.com" });
    expect(fakeDb.payloads[0]).toMatchObject({ tutorId: null });
  });

  it("lets the student approve a request naming them", async () => {
    fakeDb.queue([pendingLink], [{ ...pendingLink, status: "approved" }]);
    const res = await request(testApp(parentLinksRouter, studentA)).post("/api/parent-links/1/approve");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["update"]);
    expect(fakeDb.payloads).toEqual([{ status: "approved" }]);
  });

  it("lets the student's tutor approve it", async () => {
    fakeDb.queue(
      [pendingLink],
      [{ id: studentA.id, tutorId: tutorA.id }], // student lookup
      [{ ...pendingLink, status: "approved" }],
    );
    const res = await request(testApp(parentLinksRouter, tutorA)).post("/api/parent-links/1/approve");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["update"]);
  });

  it("forbids another tutor from approving it", async () => {
    fakeDb.queue([pendingLink], [{ id: studentA.id, tutorId: tutorA.id }]);
    const res = await request(testApp(parentLinksRouter, tutorB)).post("/api/parent-links/1/approve");
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it.each([
    ["the requesting parent", parentA],
    ["another student", studentB],
  ])("forbids %s from approving it", async (_label, user) => {
    fakeDb.queue([pendingLink]);
    const res = await request(testApp(parentLinksRouter, user)).post("/api/parent-links/1/approve");
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets the student decline (delete) the request", async () => {
    fakeDb.queue([pendingLink]);
    const res = await request(testApp(parentLinksRouter, studentA)).post("/api/parent-links/1/decline");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete"]);
  });

  it("forbids another student from declining it", async () => {
    fakeDb.queue([pendingLink]);
    const res = await request(testApp(parentLinksRouter, studentB)).post("/api/parent-links/1/decline");
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("set-role is one-time", () => {
  // set-role doesn't depend on req.user, so any signed-in test user works.
  const app = () => testApp(parentLinksRouter, null);

  it.each(["parent", "tutor"])("refuses to change an existing student to %s", async (role) => {
    fakeDb.queue([{ id: "user_1", role: "student", tutorId: tutorA.id }]);
    const res = await request(app()).post("/api/auth/set-role").send({ role });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ROLE_ALREADY_SET");
    expect(fakeDb.writes()).toEqual([]);
  });

  it("treats repeating the same role as a no-op that keeps the current tutor", async () => {
    fakeDb.queue([{ id: "user_1", role: "student", tutorId: tutorA.id }]);
    const res = await request(app()).post("/api/auth/set-role").send({ role: "student", tutorId: tutorB.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: "student", tutorId: tutorA.id });
  });

  it("rejects a tutorId that isn't a tutor", async () => {
    fakeDb.queue([{ id: "user_1", role: "pending" }], []);
    const res = await request(app()).post("/api/auth/set-role").send({ role: "student", tutorId: studentB.id });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets a pending user pick a role and a real tutor", async () => {
    fakeDb.queue([{ id: "user_1", role: "pending" }], [{ id: tutorA.id }]);
    const res = await request(app()).post("/api/auth/set-role").send({ role: "student", tutorId: tutorA.id });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[0]).toMatchObject({ role: "student", tutorId: tutorA.id });
  });
});

describe("students can't approve or complete sessions", () => {
  const session = {
    id: 1,
    tutorId: tutorA.id,
    studentId: studentA.id,
    status: "pending",
    scheduledAt: new Date("2026-10-20T10:00:00Z"),
  };

  it.each([
    [{ status: "approved" }],
    [{ status: "completed" }],
    [{ status: "pending" }],
    [{ notes: "I did great" }],
  ])("forbids the student from sending %j", async (body) => {
    fakeDb.queue([session]);
    const res = await request(testApp(sessionsRouter, studentA)).patch("/api/sessions/1").send(body);
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("still lets the student reschedule into an open slot", async () => {
    const scheduledAt = "2026-10-21T10:00:00.000Z";
    const slot = { id: 4, tutorId: tutorA.id, startsAt: new Date(scheduledAt), durationMinutes: 60, isBooked: "false" };
    fakeDb.queue(
      [session], // session lookup
      [slot], // open slot at the new time
      [{ ...session, scheduledAt: new Date(scheduledAt) }], // update session
      [], // release the old slot
      [], // book the new slot
      [{ id: studentA.id, firstName: "Sam" }],
    );
    const res = await request(testApp(sessionsRouter, studentA)).patch("/api/sessions/1").send({ scheduledAt });
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["update", "update", "update"]);
  });

  it("lets the tutor approve", async () => {
    fakeDb.queue([session], [{ ...session, status: "approved" }], [{ id: studentA.id, firstName: "Sam" }]);
    const res = await request(testApp(sessionsRouter, tutorA)).patch("/api/sessions/1").send({ status: "approved" });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads).toEqual([{ status: "approved" }]);
  });
});

describe("students can only submit their own assignments", () => {
  const assignment = { id: 7, tutorId: tutorA.id, assignedTo: studentA.id, title: "Fractions" };

  it("forbids submitting to someone else's assignment", async () => {
    fakeDb.queue([assignment]);
    const res = await request(testApp(assignmentsRouter, studentB))
      .post("/api/assignments/7/submit")
      .send({ content: "answers" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("returns 404 for a missing assignment", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(assignmentsRouter, studentA))
      .post("/api/assignments/99/submit")
      .send({ content: "answers" });
    expect(res.status).toBe(404);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets the assigned student submit", async () => {
    fakeDb.queue([assignment], [], [{ id: 1, assignmentId: 7, studentId: studentA.id, content: "answers" }]);
    const res = await request(testApp(assignmentsRouter, studentA))
      .post("/api/assignments/7/submit")
      .send({ content: "answers" });
    expect(res.status).toBe(201);
    expect(fakeDb.writes()).toEqual(["insert"]);
  });
});

describe("messaging is limited to connected people", () => {
  it("forbids a student from messaging a stranger", async () => {
    fakeDb.queue([]); // studentA has no parent links
    const res = await request(testApp(messagesRouter, studentA))
      .post("/api/messages")
      .send({ recipientId: studentB.id, content: "hi" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets a student message their tutor", async () => {
    fakeDb.queue(
      [], // parent links
      [{ id: 1, senderId: studentA.id, recipientId: tutorA.id, content: "hi" }], // insert
      [{ id: studentA.id, firstName: "Sam" }], // sender lookup
    );
    const res = await request(testApp(messagesRouter, studentA))
      .post("/api/messages")
      .send({ recipientId: tutorA.id, content: "hi" });
    expect(res.status).toBe(201);
  });

  it("forbids a tutor from messaging another tutor's student", async () => {
    fakeDb.queue([], [{ id: studentA.id }], []); // links, my students, their parents
    const res = await request(testApp(messagesRouter, tutorA))
      .post("/api/messages")
      .send({ recipientId: studentB.id, content: "hi" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("forbids starting a conversation with a stranger", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations")
      .send({ participantIds: [tutorA.id, studentB.id] });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("forbids a conversation with only yourself", async () => {
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations")
      .send({ participantIds: [studentA.id] });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets a parent message the tutor of an approved linked child", async () => {
    fakeDb.queue(
      [{ parentId: parentA.id, studentId: studentA.id, status: "approved" }], // my approved links
      [{ tutorId: tutorA.id }], // linked child's tutor
      [{ id: 1, senderId: parentA.id, recipientId: tutorA.id, content: "hi" }],
      [{ id: parentA.id, firstName: "Pat" }],
    );
    const res = await request(testApp(messagesRouter, parentA))
      .post("/api/messages")
      .send({ recipientId: tutorA.id, content: "hi" });
    expect(res.status).toBe(201);
  });
});
