import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;

function displayName(u: UserRow | undefined): string {
  if (!u) return "Unknown";
  return (
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
    u.username ||
    u.email ||
    "User"
  );
}

/** Build the client-facing shape for a set of conversations. */
async function hydrateConversations(convIds: number[]) {
  if (convIds.length === 0) return [];

  const [convs, allParts, users, msgs] = await Promise.all([
    db.select().from(conversationsTable).where(inArray(conversationsTable.id, convIds)),
    db
      .select()
      .from(conversationParticipantsTable)
      .where(inArray(conversationParticipantsTable.conversationId, convIds)),
    db.select().from(usersTable),
    db
      .select()
      .from(messagesTable)
      .where(inArray(messagesTable.conversationId, convIds))
      .orderBy(desc(messagesTable.createdAt)),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const lastByConv = new Map<number, (typeof msgs)[number]>();
  for (const m of msgs) {
    if (m.conversationId != null && !lastByConv.has(m.conversationId)) {
      lastByConv.set(m.conversationId, m);
    }
  }

  const result = convs.map((c) => {
    const participants = allParts
      .filter((p) => p.conversationId === c.id)
      .map((p) => {
        const u = userMap.get(p.userId);
        return {
          id: p.userId,
          name: displayName(u),
          role: u?.role ?? null,
          imageUrl: u?.profileImageUrl ?? null,
        };
      });
    const last = lastByConv.get(c.id);
    return {
      id: c.id,
      type: c.type,
      title: c.title,
      participants,
      lastMessage: last?.content ?? null,
      lastMessageAt: last?.createdAt ?? c.createdAt,
    };
  });

  result.sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
  return result;
}

/** Conversation ids the user participates in. */
async function conversationIdsFor(userId: string): Promise<number[]> {
  const rows = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  return rows.map((r) => r.conversationId);
}

async function isParticipant(convId: number, userId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// GET /conversations — every conversation the current user is part of.
router.get("/conversations", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const ids = await conversationIdsFor(req.user.id);
  res.json(await hydrateConversations(ids));
});

const CreateConversationBody = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  title: z.string().trim().optional(),
});

// POST /conversations — create a direct (2-person) or group conversation.
// Direct conversations are deduped: the existing one is returned if present.
router.post("/conversations", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const me = req.user.id;
  const ids = Array.from(new Set([me, ...parsed.data.participantIds]));

  // Validate every participant exists.
  const existingUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  if (existingUsers.length !== ids.length) {
    res.status(400).json({ error: "One or more participants do not exist" });
    return;
  }

  const type = ids.length <= 2 ? "direct" : "group";

  // Dedupe direct conversations between the same two people.
  if (type === "direct") {
    const other = ids.find((i) => i !== me) ?? me;
    const mine = await conversationIdsFor(me);
    const theirs = new Set(await conversationIdsFor(other));
    const shared = mine.filter((id) => theirs.has(id));
    if (shared.length > 0) {
      const directConvs = await db
        .select()
        .from(conversationsTable)
        .where(and(inArray(conversationsTable.id, shared), eq(conversationsTable.type, "direct")));
      for (const c of directConvs) {
        const parts = await db
          .select()
          .from(conversationParticipantsTable)
          .where(eq(conversationParticipantsTable.conversationId, c.id));
        if (parts.length === 2) {
          const [existing] = await hydrateConversations([c.id]);
          res.json(existing);
          return;
        }
      }
    }
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({ type, title: parsed.data.title ?? null, createdBy: me })
    .returning();

  await db
    .insert(conversationParticipantsTable)
    .values(ids.map((userId) => ({ conversationId: conv.id, userId })));

  const [created] = await hydrateConversations([conv.id]);
  res.status(201).json(created);
});

// GET /conversations/:id/messages
router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const convId = Number(req.params.id);
  if (!Number.isInteger(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  if (!(await isParticipant(convId, req.user.id))) { res.status(403).json({ error: "Not a participant" }); return; }

  const [msgs, users] = await Promise.all([
    db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(desc(messagesTable.createdAt)),
    db.select().from(usersTable),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = msgs.reverse().map((m) => {
    const sender = userMap.get(m.senderId);
    return {
      ...m,
      senderName: displayName(sender),
      senderImageUrl: sender?.profileImageUrl ?? null,
    };
  });
  res.json(result);
});

const SendBody = z.object({ content: z.string().trim().min(1) });

// POST /conversations/:id/messages
router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const convId = Number(req.params.id);
  if (!Number.isInteger(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  if (!(await isParticipant(convId, req.user.id))) { res.status(403).json({ error: "Not a participant" }); return; }

  const parsed = SendBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "content is required" }); return; }

  const [message] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, senderId: req.user.id, content: parsed.data.content })
    .returning();

  // Touch the conversation so it sorts to the top of the list.
  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const sender = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, message.senderId))
    .then((r) => r[0]);

  res.status(201).json({
    ...message,
    senderName: displayName(sender),
    senderImageUrl: sender?.profileImageUrl ?? null,
  });
});

export default router;
