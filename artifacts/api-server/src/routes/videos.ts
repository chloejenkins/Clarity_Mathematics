import { Router, type IRouter, type Request, type Response } from "express";
import { db, videosTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListVideosResponse,
  CreateVideoBody,
  DeleteVideoResponse,
} from "@workspace/api-zod";

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
      title,
      description: description ?? null,
      url,
      subject: subject ?? null,
    })
    .returning();

  res.status(201).json(video);
});

router.delete("/videos/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can delete videos" });
    return;
  }

  const id = Number(req.params.id);
  await db.delete(videosTable).where(eq(videosTable.id, id));
  res.json(DeleteVideoResponse.parse({ success: true }));
});

export default router;
