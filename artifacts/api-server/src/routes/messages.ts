import { Router, type IRouter, type Request, type Response } from "express";
import { db, messagesTable, usersTable } from "@workspace/db";
import { eq, or, and, desc } from "drizzle-orm";
import {
  ListMessagesResponse,
  SendMessageBody,
} from "@workspace/api-zod";
import { strictRateLimiter } from "../middlewares/rateLimit";
import { canContactAll } from "../lib/contacts";

const router: IRouter = Router();

router.get("/messages", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { withUserId } = req.query;
  const userId = req.user.id;

  let messages;
  if (withUserId) {
    messages = await db
      .select()
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.senderId, userId), eq(messagesTable.recipientId, withUserId as string)),
          and(eq(messagesTable.senderId, withUserId as string), eq(messagesTable.recipientId, userId))
        )
      )
      .orderBy(desc(messagesTable.createdAt));
  } else {
    messages = await db
      .select()
      .from(messagesTable)
      .where(
        or(eq(messagesTable.senderId, userId), eq(messagesTable.recipientId, userId))
      )
      .orderBy(desc(messagesTable.createdAt));
  }

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = messages.reverse().map((m) => {
    const sender = userMap.get(m.senderId);
    return {
      ...m,
      senderName: sender
        ? `${sender.firstName ?? ""} ${sender.lastName ?? ""}`.trim() || sender.username || "User"
        : "Unknown",
      senderImageUrl: sender?.profileImageUrl ?? null,
    };
  });

  res.json(ListMessagesResponse.parse(result));
});

router.post("/messages", strictRateLimiter, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { recipientId, content } = parsed.data;

  // Only people you're connected to (your tutor, students, linked parents/children).
  if (!(await canContactAll(req.user, [recipientId]))) {
    res.status(403).json({ error: "You can only message people you're connected to" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      senderId: req.user.id,
      recipientId,
      content,
    })
    .returning();

  const sender = await db.select().from(usersTable).where(eq(usersTable.id, message.senderId)).then(r => r[0]);
  const senderName = sender
    ? `${sender.firstName ?? ""} ${sender.lastName ?? ""}`.trim() || sender.username || "User"
    : "Unknown";

  res.status(201).json({
    ...message,
    senderName,
    senderImageUrl: sender?.profileImageUrl ?? null,
  });
});

export default router;
