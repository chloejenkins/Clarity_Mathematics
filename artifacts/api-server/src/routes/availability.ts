import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { availabilitySlotsTable, tutoringSessionsTable } from "@workspace/db/schema";
import { eq, gte, asc, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreateSlotBody = z.object({
  startsAt: z.string().min(1, "Date/time required"),
  durationMinutes: z.coerce.number().min(15).max(240).default(60),
  topic: z.string().optional(),
});

// GET /api/availability, list slots
// Tutors see their own; students/parents see ALL tutors' unbooked slots with tutor info
router.get("/availability", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const now = new Date();

  if (req.user.role === "tutor") {
    const slots = await db
      .select()
      .from(availabilitySlotsTable)
      .where(and(
        eq(availabilitySlotsTable.tutorId, req.user.id),
        gte(availabilitySlotsTable.startsAt, now),
      ))
      .orderBy(asc(availabilitySlotsTable.startsAt));
    res.json(slots);
    return;
  }

  // students/parents: show all unbooked slots from all tutors, enriched with tutor name
  const slots = await db
    .select()
    .from(availabilitySlotsTable)
    .where(and(
      eq(availabilitySlotsTable.isBooked, "false"),
      gte(availabilitySlotsTable.startsAt, now),
    ))
    .orderBy(asc(availabilitySlotsTable.startsAt));

  // Fetch tutor info for each unique tutorId
  const tutorIds = [...new Set(slots.map(s => s.tutorId).filter(Boolean) as string[])];
  const tutors = tutorIds.length
    ? await db.select().from(usersTable).then(rows => rows.filter(r => tutorIds.includes(r.id)))
    : [];
  const tutorMap = new Map(tutors.map(t => [t.id, t]));

  const enriched = slots.map(slot => {
    const tutor = slot.tutorId ? tutorMap.get(slot.tutorId) : null;
    return {
      ...slot,
      tutorName: tutor
        ? `${tutor.firstName ?? ""} ${tutor.lastName ?? ""}`.trim() || tutor.username || "Tutor"
        : "Tutor",
      tutorProfileImageUrl: tutor?.profileImageUrl ?? null,
    };
  });

  res.json(enriched);
});

// POST /api/availability, tutor creates slots
router.post("/availability", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Only tutors can create slots" }); return; }

  const bodyArray = Array.isArray(req.body) ? req.body : [req.body];
  const parsed = z.array(CreateSlotBody).safeParse(bodyArray);
  if (!parsed.success) { res.status(400).json({ error: "Invalid slot data", details: parsed.error.issues }); return; }

  const inserted = await db
    .insert(availabilitySlotsTable)
    .values(parsed.data.map(s => ({
      tutorId: req.user.id,
      startsAt: new Date(s.startsAt),
      durationMinutes: s.durationMinutes,
      topic: s.topic ?? null,
      isBooked: "false",
    })))
    .returning();

  res.status(201).json(inserted);
});

// DELETE /api/availability/:id, tutor removes an unbooked slot
router.delete("/availability/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "tutor") { res.status(403).json({ error: "Only tutors can delete slots" }); return; }

  const id = Number(req.params.id);
  const [slot] = await db.select().from(availabilitySlotsTable).where(eq(availabilitySlotsTable.id, id)).limit(1);
  if (!slot) { res.status(404).json({ error: "Slot not found" }); return; }
  if (slot.tutorId !== req.user.id) { res.status(403).json({ error: "You can only delete your own slots" }); return; }
  if (slot.isBooked === "true") { res.status(400).json({ error: "Cannot delete a booked slot" }); return; }

  await db.delete(availabilitySlotsTable).where(eq(availabilitySlotsTable.id, id));
  res.json({ success: true });
});

// POST /api/availability/:id/book, student or parent books a slot
router.post("/availability/:id/book", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "student" && req.user.role !== "parent") {
    res.status(403).json({ error: "Only students or parents can book slots" });
    return;
  }

  const id = Number(req.params.id);
  const [slot] = await db.select().from(availabilitySlotsTable).where(eq(availabilitySlotsTable.id, id)).limit(1);
  if (!slot) { res.status(404).json({ error: "Slot not found" }); return; }
  if (slot.isBooked === "true") { res.status(409).json({ error: "This slot is already booked" }); return; }

  const topic = (req.body as { topic?: string }).topic;

  const [session] = await db
    .insert(tutoringSessionsTable)
    .values({
      tutorId: slot.tutorId ?? null,
      studentId: req.user.id,
      scheduledAt: slot.startsAt,
      durationMinutes: slot.durationMinutes,
      topic: topic ?? slot.topic ?? null,
      status: "approved",
    })
    .returning();

  await db
    .update(availabilitySlotsTable)
    .set({ isBooked: "true", bookedByStudentId: req.user.id, sessionId: session.id })
    .where(eq(availabilitySlotsTable.id, id));

  res.status(201).json({ session, slotId: id });
});

export default router;
