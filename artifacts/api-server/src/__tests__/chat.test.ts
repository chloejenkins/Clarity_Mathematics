import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { fakeDb } from "./helpers/fakeDb";
import { testApp, tutorA, tutorB, studentA, studentB } from "./helpers/testApp";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

const conversationsRouter = (await import("../routes/conversations")).default;

beforeEach(() => fakeDb.reset());

const t = (iso: string) => new Date(iso);

describe("unread messages", () => {
  it("counts only other people's messages since I last read each conversation", async () => {
    fakeDb.queue(
      [{ conversationId: 9 }, { conversationId: 10 }], // my conversation ids
      [
        { id: 9, type: "direct", title: null, createdAt: t("2026-11-01T09:00:00Z") },
        { id: 10, type: "direct", title: null, createdAt: t("2026-11-01T09:00:00Z") },
      ],
      [
        { conversationId: 9, userId: tutorA.id, lastReadAt: t("2026-11-02T10:00:00Z") },
        { conversationId: 9, userId: studentA.id, lastReadAt: null },
        { conversationId: 10, userId: tutorA.id, lastReadAt: null },
        { conversationId: 10, userId: studentB.id, lastReadAt: null },
      ],
      [{ id: studentA.id, firstName: "Sam", role: "student" }],
      // newest first, as the query orders them
      [
        { id: 4, conversationId: 9, senderId: studentA.id, content: "new", createdAt: t("2026-11-02T11:00:00Z") },
        { id: 3, conversationId: 9, senderId: tutorA.id, content: "mine", createdAt: t("2026-11-02T10:30:00Z") },
        { id: 2, conversationId: 9, senderId: studentA.id, content: "old", createdAt: t("2026-11-02T09:00:00Z") },
        { id: 1, conversationId: 10, senderId: studentB.id, content: "hello", createdAt: t("2026-11-01T09:30:00Z") },
      ],
    );
    const res = await request(testApp(conversationsRouter, tutorA)).get("/api/conversations");
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.map((c: { id: number; unreadCount: number }) => [c.id, c.unreadCount]));
    expect(byId).toEqual({ 9: 1, 10: 1 });
  });

  it("totals unread messages for the Chat badge", async () => {
    fakeDb.queue(
      [
        { conversationId: 9, userId: tutorA.id, lastReadAt: t("2026-11-02T10:00:00Z") },
        { conversationId: 10, userId: tutorA.id, lastReadAt: null },
      ],
      [
        { conversationId: 9, senderId: studentA.id, createdAt: t("2026-11-02T09:00:00Z") },
        { conversationId: 9, senderId: studentA.id, createdAt: t("2026-11-02T11:00:00Z") },
        { conversationId: 10, senderId: studentB.id, createdAt: t("2026-11-01T09:30:00Z") },
        { conversationId: 10, senderId: studentB.id, createdAt: t("2026-11-01T09:31:00Z") },
      ],
    );
    const res = await request(testApp(conversationsRouter, tutorA)).get("/api/conversations/unread");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3 });
  });

  it("is zero with no conversations", async () => {
    fakeDb.queue([]);
    const res = await request(testApp(conversationsRouter, studentA)).get("/api/conversations/unread");
    expect(res.body).toEqual({ count: 0 });
    expect(fakeDb.calls).toEqual(["select"]);
  });

  it("marks a conversation read for the caller only if they're in it", async () => {
    fakeDb.queue([]); // not a participant
    expect((await request(testApp(conversationsRouter, studentB)).post("/api/conversations/9/read")).status).toBe(403);
    expect(fakeDb.writes()).toEqual([]);

    fakeDb.queue([{ conversationId: 9, userId: studentA.id }]);
    const res = await request(testApp(conversationsRouter, studentA)).post("/api/conversations/9/read");
    expect(res.status).toBe(200);
    expect(fakeDb.writes()).toEqual(["update"]);
    expect(fakeDb.payloads[0]).toMatchObject({ lastReadAt: expect.any(Date) });
  });
});

describe("sending messages", () => {
  it("rejects very long messages with a clear reason", async () => {
    fakeDb.queue([{ conversationId: 9, userId: studentA.id }]);
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations/9/messages")
      .send({ content: "x".repeat(4001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/4000 characters/);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("rejects blank messages", async () => {
    fakeDb.queue([{ conversationId: 9, userId: studentA.id }]);
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations/9/messages")
      .send({ content: "   " });
    expect(res.status).toBe(400);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("stops a one-to-one chat once the two people are no longer connected", async () => {
    fakeDb.queue(
      [{ conversationId: 9, userId: studentA.id }], // isParticipant
      [{ id: 9, type: "direct" }],
      [
        { conversationId: 9, userId: studentA.id },
        { conversationId: 9, userId: tutorB.id }, // studentA's tutor is now tutorA
      ],
      [], // studentA's parent links
    );
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations/9/messages")
      .send({ content: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/no longer connected/);
    expect(fakeDb.writes()).toEqual([]);
  });

  it("sends in a one-to-one chat with my tutor and marks it read for me", async () => {
    const sentAt = t("2026-11-02T12:00:00Z");
    fakeDb.queue(
      [{ conversationId: 9, userId: studentA.id }],
      [{ id: 9, type: "direct" }],
      [
        { conversationId: 9, userId: studentA.id },
        { conversationId: 9, userId: tutorA.id },
      ],
      [], // parent links
      [{ id: 1, conversationId: 9, senderId: studentA.id, content: "hi", createdAt: sentAt }],
      [], // touch conversation
      [], // mark read
      [{ id: studentA.id, firstName: "Sam" }],
    );
    const res = await request(testApp(conversationsRouter, studentA))
      .post("/api/conversations/9/messages")
      .send({ content: "  hi  " });
    expect(res.status).toBe(201);
    expect(fakeDb.writes()).toEqual(["insert", "update", "update"]);
    expect(fakeDb.payloads).toContainEqual({ conversationId: 9, senderId: studentA.id, content: "hi" });
    expect(fakeDb.payloads).toContainEqual({ lastReadAt: sentAt });
  });
});
