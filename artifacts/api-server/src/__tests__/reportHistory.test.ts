// Parent reports are kept as a history of dated entries rather than one
// report that each save overwrites.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, tutorB, studentA, type TestUser } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const parentFeedbackRouter = (await import("../routes/parentFeedback")).default;

beforeEach(() => fakeDb.reset());

const parentA = { id: "parent-a", role: "parent", tutorId: tutorA.id } as unknown as TestUser;

const report = {
  id: 4,
  tutorId: tutorA.id,
  studentId: studentA.id,
  content: "Factoring is solid.",
  period: "October",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("adding a report", () => {
  it("inserts a new entry, leaving earlier reports alone", async () => {
    fakeDb.queue([{ id: studentA.id, role: "student" }], [{ ...report, id: 5 }]);
    const res = await request(testApp(parentFeedbackRouter, tutorA))
      .post(`/api/parent-feedback/${studentA.id}`)
      .send({ content: "Now on completing the square.", period: " November " });
    expect(res.status).toBe(201);
    expect(fakeDb.writes()).toEqual(["insert"]);
    expect(fakeDb.payloads[0]).toEqual({
      tutorId: tutorA.id,
      studentId: studentA.id,
      content: "Now on completing the square.",
      period: "November",
    });
  });

  it("refuses an empty report", async () => {
    const res = await request(testApp(parentFeedbackRouter, tutorA))
      .post(`/api/parent-feedback/${studentA.id}`)
      .send({ content: "   " });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("refuses a report about someone who isn't a student or parent", async () => {
    fakeDb.queue([{ id: tutorB.id, role: "tutor" }]);
    const res = await request(testApp(parentFeedbackRouter, tutorA))
      .post(`/api/parent-feedback/${tutorB.id}`)
      .send({ content: "Hello" });
    expect(res.status).toBe(404);
    expect(fakeDb.writes()).toEqual([]);
  });

  it.each([
    ["a student", studentA],
    ["a parent", parentA],
  ])("refuses %s", async (_label, user) => {
    const res = await request(testApp(parentFeedbackRouter, user))
      .post(`/api/parent-feedback/${studentA.id}`)
      .send({ content: "Hello" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("changing one report", () => {
  it("lets its tutor edit it", async () => {
    fakeDb.queue([report], [{ ...report, content: "Edited" }]);
    const res = await request(testApp(parentFeedbackRouter, tutorA))
      .patch("/api/parent-feedback/entries/4")
      .send({ content: "Edited", period: null });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[0]).toEqual({ content: "Edited", period: null });
  });

  it("lets its tutor delete it", async () => {
    fakeDb.queue([report]);
    const res = await request(testApp(parentFeedbackRouter, tutorA)).delete("/api/parent-feedback/entries/4");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete"]);
  });

  it("refuses another tutor", async () => {
    const app = testApp(parentFeedbackRouter, tutorB);
    fakeDb.queue([report]);
    expect((await request(app).patch("/api/parent-feedback/entries/4").send({ content: "Mine" })).status).toBe(403);
    fakeDb.queue([report]);
    expect((await request(app).delete("/api/parent-feedback/entries/4")).status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("returns 404 for a report that doesn't exist", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(parentFeedbackRouter, tutorA)).delete("/api/parent-feedback/entries/99");
    expect(res.status).toBe(404);
  });
});

describe("reading the history", () => {
  it("gives a linked parent every report, not just the latest", async () => {
    const older = { ...report, id: 3, content: "September notes" };
    fakeDb.queue([{ parentId: parentA.id, studentId: studentA.id, status: "approved" }], [report, older]);
    const res = await request(testApp(parentFeedbackRouter, parentA)).get(`/api/parent-feedback/${studentA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: number }) => r.id)).toEqual([4, 3]);
  });
});
