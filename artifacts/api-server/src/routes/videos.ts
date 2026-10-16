import { Router, type IRouter, type Request, type Response } from "express";
import { db, videosTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  ListVideosResponse,
  CreateVideoBody,
  DeleteVideoResponse,
} from "@workspace/api-zod";

// The library is shared: every signed-in student, parent and tutor sees every
// video. Tutors add videos, and can edit or remove the ones they added (plus
// older videos saved before the uploader was recorded).

// null clears an optional field.
const UpdateVideoInput = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullish(),
  url: z.string().trim().min(1).optional(),
  subject: z.string().nullish(),
});

const router: IRouter = Router();

router.get("/videos", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const videos = await db
    .select()
    .from(videosTable)
    .orderBy(desc(videosTable.createdAt));

  res.json(ListVideosResponse.parse(videos));
});

router.post("/videos", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can share videos" });
    return;
  }

  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { title, description, url, subject } = parsed.data;

  const [video] = await db
    .insert(videosTable)
    .values({
      tutorId: req.user.id,
      title,
      description: description?.trim() || null,
      url,
      subject: subject?.trim() || null,
    })
    .returning();

  res.status(201).json(video);
});

// Loads the video and checks the signed-in tutor may change it. Sends the
// error response and returns null when they can't.
async function findEditableVideo(req: Request, res: Response, action: "edit" | "delete") {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (req.user.role !== "tutor") {
    res.status(403).json({ error: `Only tutors can ${action} videos` });
    return null;
  }

  const id = Number(req.params.id);
  const [existing] = await db.select().from(videosTable).where(eq(videosTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Video not found" });
    return null;
  }
  if (existing.tutorId && existing.tutorId !== req.user.id) {
    res.status(403).json({ error: `You can only ${action} videos you added` });
    return null;
  }
  return existing;
}

router.patch("/videos/:id", async (req: Request, res: Response) => {
  const existing = await findEditableVideo(req, res, "edit");
  if (!existing) return;

  const parsed = UpdateVideoInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<typeof videosTable.$inferInsert> = {};
  const { title, description, url, subject } = parsed.data;
  if (title !== undefined) updates.title = title;
  if (url !== undefined) updates.url = url;
  if (description !== undefined) updates.description = description?.trim() || null;
  if (subject !== undefined) updates.subject = subject?.trim() || null;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [updated] = await db
    .update(videosTable)
    .set(updates)
    .where(eq(videosTable.id, existing.id))
    .returning();

  res.json(updated);
});

router.delete("/videos/:id", async (req: Request, res: Response) => {
  const existing = await findEditableVideo(req, res, "delete");
  if (!existing) return;

  await db.delete(videosTable).where(eq(videosTable.id, existing.id));
  res.json(DeleteVideoResponse.parse({ success: true }));
});

export default router;
