// Editing an assignment, and worksheets the tutor attaches to one.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import os from "node:os";
import path from "node:path";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, tutorB, studentA, studentB, type TestUser } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

process.env.UPLOADS_DIR = path.join(os.tmpdir(), "api-server-test-uploads");
const assignmentsRouter = (await import("../routes/assignments")).default;
const uploadsRouter = (await import("../routes/uploads")).default;

beforeEach(() => fakeDb.reset());

const parentA = { id: "parent-a", role: "parent", tutorId: tutorA.id } as unknown as TestUser;

const assignment = {
  id: 7,
  tutorId: tutorA.id,
  assignedTo: studentA.id,
  title: "Fractions",
  description: "Page 12",
  subject: "Math",
  dueDate: new Date("2026-10-20T03:59:00Z"),
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

describe("editing an assignment", () => {
  it("lets its tutor change the title and clear the due date", async () => {
    fakeDb.queue(
      [assignment],
      [{ ...assignment, title: "Fractions, part 2", dueDate: null }],
      [{ id: studentA.id, firstName: "Sam" }],
    );
    const res = await request(testApp(assignmentsRouter, tutorA))
      .patch("/api/assignments/7")
      .send({ title: "Fractions, part 2", dueDate: null });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[0]).toEqual({ title: "Fractions, part 2", dueDate: null });
    expect(res.body.assignedToName).toBe("Sam");
  });

  it("accepts a due date sent as an ISO string", async () => {
    fakeDb.queue([assignment], [assignment], []);
    const res = await request(testApp(assignmentsRouter, tutorA))
      .patch("/api/assignments/7")
      .send({ dueDate: "2026-10-23T03:59:00.000Z" });
    expect(res.status).toBe(200);
    expect(fakeDb.payloads[0]).toEqual({ dueDate: new Date("2026-10-23T03:59:00.000Z") });
  });

  it("refuses a blank title", async () => {
    fakeDb.queue([assignment]);
    const res = await request(testApp(assignmentsRouter, tutorA)).patch("/api/assignments/7").send({ title: "  " });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });

  it.each([
    ["another tutor", tutorB],
    ["the student", studentA],
  ])("refuses %s", async (_label, user) => {
    fakeDb.queue([assignment]);
    const res = await request(testApp(assignmentsRouter, user)).patch("/api/assignments/7").send({ title: "Mine now" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("worksheets on assignments", () => {
  const upload = (user: TestUser) =>
    request(testApp(uploadsRouter, user))
      .post("/api/uploads")
      .field("assignmentId", "7")
      .attach("file", Buffer.from("%PDF-1.4"), { filename: "worksheet.pdf", contentType: "application/pdf" });

  it("lets the assignment's tutor attach a worksheet", async () => {
    fakeDb.queue([assignment], [{ id: 1, assignmentId: 7, uploadedBy: tutorA.id, filename: "worksheet.pdf" }], []);
    const res = await upload(tutorA);
    expect(res.status).toBe(201);
    expect(fakeDb.payloads[0]).toMatchObject({ assignmentId: 7, uploadedBy: tutorA.id, tutorId: tutorA.id });
  });

  it.each([
    ["another tutor", tutorB],
    ["a student it wasn't given to", studentB],
  ])("refuses a file from %s", async (_label, user) => {
    fakeDb.queue([assignment]);
    const res = await upload(user);
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("refuses a file on an assignment that doesn't exist", async () => {
    fakeDb.queue([]);
    const res = await upload(studentA);
    expect(res.status).toBe(404);
    expect(fakeDb.writes()).toEqual([]);
  });

  const worksheet = {
    id: 3,
    assignmentId: 7,
    uploadedBy: tutorA.id,
    tutorId: tutorA.id,
    storageKey: "does-not-exist",
    filename: "worksheet.pdf",
  };

  // The file isn't on disk, so a caller who passes the access check gets 404.
  const links = [{ studentId: studentA.id }];
  it.each([
    ["the student it was given to", studentA, [[assignment]]],
    ["their linked parent", parentA, [links, [assignment], links]],
  ])("lets %s download it", async (_label, user, lookups) => {
    fakeDb.queue([worksheet], ...lookups);
    const res = await request(testApp(uploadsRouter, user)).get("/api/uploads/3/download");
    expect(res.status).toBe(404);
  });

  it("refuses another family", async () => {
    fakeDb.queue([worksheet], [assignment]);
    const res = await request(testApp(uploadsRouter, studentB)).get("/api/uploads/3/download");
    expect(res.status).toBe(403);
  });

  it("doesn't share a file the assignment's tutor didn't upload", async () => {
    fakeDb.queue([{ ...worksheet, uploadedBy: studentB.id, tutorId: tutorB.id }], [assignment]);
    const res = await request(testApp(uploadsRouter, studentA)).get("/api/uploads/3/download");
    expect(res.status).toBe(403);
  });
});
