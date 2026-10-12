import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, tutorB, studentA, studentB } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const sessionsRouter = (await import("../routes/sessions")).default;
const assignmentsRouter = (await import("../routes/assignments")).default;
const uploadsRouter = (await import("../routes/uploads")).default;
const conversationsRouter = (await import("../routes/conversations")).default;

beforeEach(() => fakeDb.reset());

const session = {
  id: 1,
  tutorId: tutorA.id,
  studentId: studentA.id,
  status: "scheduled",
  scheduledAt: new Date("2026-10-01T10:00:00Z"),
};

describe("sessions/:id ownership", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(testApp(sessionsRouter, null)).get("/api/sessions/1");
    expect(res.status).toBe(401);
    expect(fakeDb.calls).toEqual([]);
  });

  it("returns 404 for a missing session", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(sessionsRouter, tutorA)).get("/api/sessions/1");
    expect(res.status).toBe(404);
  });

  it.each([
    ["the session's tutor", tutorA],
    ["the session's student", studentA],
  ])("lets %s read it", async (_label, user) => {
    fakeDb.queue([session], [{ id: studentA.id, firstName: "Sam", lastName: "Lee" }]);
    const res = await request(testApp(sessionsRouter, user)).get("/api/sessions/1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, studentName: "Sam Lee" });
  });

  it.each([
    ["another tutor", tutorB],
    ["another student", studentB],
  ])("forbids %s from reading, editing or deleting it", async (_label, user) => {
    const app = testApp(sessionsRouter, user);

    fakeDb.queue([session]);
    expect((await request(app).get("/api/sessions/1")).status).toBe(403);

    fakeDb.queue([session]);
    expect((await request(app).patch("/api/sessions/1").send({ status: "cancelled" })).status).toBe(403);

    fakeDb.queue([session]);
    expect((await request(app).delete("/api/sessions/1")).status).toBe(403);

    expect(fakeDb.writes()).toEqual([]);
  });

  it("does not treat a student id match on the tutor field as tutor access", async () => {
    // A student whose id happens to equal session.tutorId is not the tutor.
    const impostor = { ...studentB, id: tutorA.id };
    fakeDb.queue([{ ...session, studentId: "someone-else" }]);
    const res = await request(testApp(sessionsRouter, impostor)).delete("/api/sessions/1");
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets the owning tutor delete it", async () => {
    fakeDb.queue([session]);
    const res = await request(testApp(sessionsRouter, tutorA)).delete("/api/sessions/1");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete"]);
  });
});

describe("assignment ownership", () => {
  const assignment = { id: 7, tutorId: tutorA.id, title: "Fractions" };

  it("forbids students from editing or deleting assignments", async () => {
    const app = testApp(assignmentsRouter, studentA);
    expect((await request(app).patch("/api/assignments/7").send({ title: "x" })).status).toBe(403);
    expect((await request(app).delete("/api/assignments/7")).status).toBe(403);
    expect(fakeDb.calls).toEqual([]);
  });

  it("forbids another tutor from editing or deleting an assignment", async () => {
    const app = testApp(assignmentsRouter, tutorB);

    fakeDb.queue([assignment]);
    const patch = await request(app).patch("/api/assignments/7").send({ title: "x" });
    expect(patch.status).toBe(403);

    fakeDb.queue([assignment]);
    const del = await request(app).delete("/api/assignments/7");
    expect(del.status).toBe(403);

    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets the owning tutor edit it", async () => {
    fakeDb.queue([assignment], [{ ...assignment, title: "Decimals" }]);
    const res = await request(testApp(assignmentsRouter, tutorA))
      .patch("/api/assignments/7")
      .send({ title: "Decimals" });
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["update"]);
  });

  it("forbids reviewing a submission on another tutor's assignment", async () => {
    fakeDb.queue([{ id: 3, assignmentId: 7, studentId: studentA.id }], [assignment]);
    const res = await request(testApp(assignmentsRouter, tutorB))
      .post("/api/submissions/3/review")
      .send({ comment: "Nice" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("upload ownership", () => {
  const attachment = {
    id: 5,
    uploadedBy: studentA.id,
    tutorId: tutorA.id,
    storageKey: "does-not-exist",
    filename: "homework.pdf",
    mimeType: "application/pdf",
  };

  it.each([
    ["another tutor", tutorB],
    ["another student", studentB],
  ])("forbids %s from downloading or deleting a file", async (_label, user) => {
    const app = testApp(uploadsRouter, user);

    fakeDb.queue([attachment]);
    expect((await request(app).get("/api/uploads/5/download")).status).toBe(403);

    fakeDb.queue([attachment]);
    expect((await request(app).delete("/api/uploads/5")).status).toBe(403);

    expect(fakeDb.writes()).toEqual([]);
  });

  it.each([
    ["the uploader", studentA],
    ["the tutor it was routed to", tutorA],
  ])("lets %s delete a file", async (_label, user) => {
    fakeDb.queue([attachment]);
    const res = await request(testApp(uploadsRouter, user)).delete("/api/uploads/5");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete"]);
  });
});

describe("conversation participation", () => {
  it("forbids non-participants from reading or posting", async () => {
    const app = testApp(conversationsRouter, studentB);

    fakeDb.queue([]); // isParticipant -> no row
    expect((await request(app).get("/api/conversations/9/messages")).status).toBe(403);

    fakeDb.queue([]);
    const post = await request(app).post("/api/conversations/9/messages").send({ content: "hi" });
    expect(post.status).toBe(403);

    expect(fakeDb.writes()).toEqual([]);
  });

  it("lets a participant post", async () => {
    fakeDb.queue(
      [{ conversationId: 9, userId: studentA.id }], // isParticipant
      [{ id: 1, conversationId: 9, senderId: studentA.id, content: "hi" }], // insert
      [], // touch conversation
      [{ id: studentA.id, firstName: "Sam" }], // sender lookup
    );
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations/9/messages")
      .send({ content: "hi" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ content: "hi", senderName: "Sam" });
  });
});
