import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray, desc, ne } from "drizzle-orm";
import { z } from "zod";
import { strictRateLimiter } from "../middlewares/rateLimit";
import { canContactAll } from "../lib/contacts";

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

type ParticipantRow = typeof conversationParticipantsTable.$inferSelect;
type MessageRow = typeof messagesTable.$inferSelect;

/** Messages from other people that arrived after `me` last read the conversation. */
function countUnread(msgs: MessageRow[], myRow: ParticipantRow | undefined, me: string): number {
  if (!myRow) return 0;
  const since = myRow.lastReadAt ? new Date(myRow.lastReadAt).getTime() : -Infinity;
  return msgs.filter(
    (m) => m.senderId !== me && new Date(m.createdAt).getTime() > since,
  ).length;
}

/** Build the client-facing shape for a set of conversations, as seen by `me`. */
async function hydrateConversations(convIds: number[], me: string) {
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
  const lastByConv = new Map<number, MessageRow>();
  const msgsByConv = new Map<number, MessageRow[]>();
  for (const m of msgs) {
    if (m.conversationId == null) continue;
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
    const list = msgsByConv.get(m.conversationId) ?? [];
    list.push(m);
    msgsByConv.set(m.conversationId, list);
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
      unreadCount: countUnread(
        msgsByConv.get(c.id) ?? [],
        allParts.find((p) => p.conversationId === c.id && p.userId === me),
        me,
      ),
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

// GET /conversations, every conversation the current user is part of.
router.get("/conversations", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const ids = await conversationIdsFor(req.user.id);
  res.json(await hydrateConversations(ids, req.user.id));
});

const CreateConversationBody = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  title: z.string().trim().optional(),
});

// POST /conversations, create a direct (2-person) or group conversation.
// Direct conversations are deduped: the existing one is returned if present.
router.post("/conversations", strictRateLimiter, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const me = req.user.id;
  const ids = Array.from(new Set([me, ...parsed.data.participantIds]));

  // Only people you're connected to (your tutor, students, linked parents/children).
  const others = ids.filter((id) => id !== me);
  if (others.length === 0 || !(await canContactAll(req.user, others))) {
    res.status(403).json({ error: "You can only message people you're connected to" });
    return;
  }

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
          const [existing] = await hydrateConversations([c.id], me);
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

  const [created] = await hydrateConversations([conv.id], me);
  res.status(201).json(created);
});

// GET /conversations/unread, total unread messages across all my conversations
// (drives the badge on Chat in the sidebar and tab bar).
router.get("/conversations/unread", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = req.user.id;
  const mine = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, me));
  if (mine.length === 0) { res.json({ count: 0 }); return; }
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        inArray(messagesTable.conversationId, mine.map((p) => p.conversationId)),
        ne(messagesTable.senderId, me),
      ),
    );
  let count = 0;
  for (const p of mine) {
    count += countUnread(msgs.filter((m) => m.conversationId === p.conversationId), p, me);
  }
  res.json({ count });
});

// POST /conversations/:id/read, the caller has now seen everything in it.
router.post("/conversations/:id/read", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const convId = Number(req.params.id);
  if (!Number.isInteger(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  if (!(await isParticipant(convId, req.user.id))) { res.status(403).json({ error: "Not a participant" }); return; }
  await db
    .update(conversationParticipantsTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, req.user.id),
      ),
    );
  res.json({ success: true });
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

export const MAX_MESSAGE_LENGTH = 4000;
const SendBody = z.object({ content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH) });

// POST /conversations/:id/messages
router.post("/conversations/:id/messages", strictRateLimiter, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const convId = Number(req.params.id);
  if (!Number.isInteger(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  if (!(await isParticipant(convId, req.user.id))) { res.status(403).json({ error: "Not a participant" }); return; }

  const parsed = SendBody.safeParse(req.body);
  if (!parsed.success) {
    const tooLong = typeof req.body?.content === "string" && req.body.content.trim().length > MAX_MESSAGE_LENGTH;
    res.status(400).json({
      error: tooLong
        ? `Messages can be up to ${MAX_MESSAGE_LENGTH} characters`
        : "content is required",
    });
    return;
  }

  // In a one-to-one chat, both people must still be connected: if a parent
  // link is removed or a student moves to another tutor, the old chat stays
  // readable but no new messages can be sent into it.
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, convId))
    .limit(1);
  if (conv?.type === "direct") {
    const parts = await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, convId));
    const others = parts.map((p) => p.userId).filter((id) => id !== req.user.id);
    if (others.length > 0 && !(await canContactAll(req.user, others))) {
      res.status(403).json({ error: "You're no longer connected to this person, so you can't message them" });
      return;
    }
  }

  const [message] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, senderId: req.user.id, content: parsed.data.content })
    .returning();

  // Touch the conversation so it sorts to the top of the list, and count it
  // as read by the sender (they've clearly seen it if they're replying).
  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));
  await db
    .update(conversationParticipantsTable)
    .set({ lastReadAt: message.createdAt })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, req.user.id),
      ),
    );

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
