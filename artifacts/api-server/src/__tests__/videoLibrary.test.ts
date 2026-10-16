import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, tutorB, studentA, studentB, type TestUser } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const videosRouter = (await import("../routes/videos")).default;

beforeEach(() => fakeDb.reset());

const parentA = { id: "parent-a", role: "parent", tutorId: null } as unknown as TestUser;

const video = {
  id: 1,
  tutorId: tutorA.id,
  title: "Adding fractions",
  description: null,
  url: "https://youtu.be/abcdefghijk",
  subject: "Fractions",
  createdAt: new Date("2026-10-01T10:00:00Z"),
};

describe("the video library is shared", () => {
  it.each([
    ["a student", studentA],
    ["another tutor's student", studentB],
    ["a parent", parentA],
    ["a tutor", tutorB],
  ])("lists every video for %s", async (_label, user) => {
    fakeDb.queue([video, { ...video, id: 2, tutorId: tutorB.id }]);
    const res = await request(testApp(videosRouter, user)).get("/api/videos");
    expect(res.status).toBe(200);
    expect(res.body.map((v: { id: number }) => v.id)).toEqual([1, 2]);
  });

  it("rejects signed-out visitors", async () => {
    const res = await request(testApp(videosRouter, null)).get("/api/videos");
    expect(res.status).toBe(401);
  });

  it("records which tutor added a video", async () => {
    fakeDb.queue([video]);
    const res = await request(testApp(videosRouter, tutorA))
      .post("/api/videos")
      .send({ title: "Adding fractions", url: video.url, subject: " Fractions ", description: "  " });
    expect(res.status).toBe(201);
    expect(fakeDb.payloads[0]).toMatchObject({ tutorId: tutorA.id, subject: "Fractions", description: null });
  });

  it("doesn't let students add videos", async () => {
    const res = await request(testApp(videosRouter, studentA))
      .post("/api/videos")
      .send({ title: "x", url: video.url });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("editing a library video", () => {
  it("lets the tutor who added it change the topic", async () => {
    fakeDb.queue([video], [{ ...video, subject: "Number" }]);
    const res = await request(testApp(videosRouter, tutorA))
      .patch("/api/videos/1")
      .send({ subject: "Number" });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe("Number");
    expect(fakeDb.payloads[0]).toEqual({ subject: "Number" });
  });

  it("clears a topic sent as null", async () => {
    fakeDb.queue([video], [{ ...video, subject: null }]);
    await request(testApp(videosRouter, tutorA)).patch("/api/videos/1").send({ subject: null });
    expect(fakeDb.payloads[0]).toEqual({ subject: null });
  });

  it("lets any tutor edit an older video with no recorded uploader", async () => {
    fakeDb.queue([{ ...video, tutorId: null }], [{ ...video, tutorId: null, title: "New" }]);
    const res = await request(testApp(videosRouter, tutorB)).patch("/api/videos/1").send({ title: "New" });
    expect(res.status).toBe(200);
  });

  it("stops a tutor editing another tutor's video", async () => {
    fakeDb.queue([video]);
    const res = await request(testApp(videosRouter, tutorB)).patch("/api/videos/1").send({ title: "Mine now" });
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("stops students editing videos", async () => {
    const res = await request(testApp(videosRouter, studentA)).patch("/api/videos/1").send({ title: "x" });
    expect(res.status).toBe(403);
    expect(fakeDb.calls).toEqual([]);
  });

  it("returns 404 for a missing video", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(videosRouter, tutorA)).patch("/api/videos/9").send({ title: "x" });
    expect(res.status).toBe(404);
  });

  it("rejects an empty title or an empty update", async () => {
    fakeDb.queue([video]);
    const blank = await request(testApp(videosRouter, tutorA)).patch("/api/videos/1").send({ title: "  " });
    expect(blank.status).toBe(400);
    fakeDb.queue([video]);
    const empty = await request(testApp(videosRouter, tutorA)).patch("/api/videos/1").send({});
    expect(empty.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });
});

describe("removing a library video", () => {
  it("lets the tutor who added it remove it", async () => {
    fakeDb.queue([video]);
    const res = await request(testApp(videosRouter, tutorA)).delete("/api/videos/1");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["delete"]);
  });

  it("stops a tutor removing another tutor's video", async () => {
    fakeDb.queue([video]);
    const res = await request(testApp(videosRouter, tutorB)).delete("/api/videos/1");
    expect(res.status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("returns 404 for a missing video", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(videosRouter, tutorA)).delete("/api/videos/9");
    expect(res.status).toBe(404);
    expect(fakeDb.writes()).toEqual([]);
  });
});
