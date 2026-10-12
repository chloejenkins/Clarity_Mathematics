import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { parentStudentLinksTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { strictRateLimiter } from "../middlewares/rateLimit";
import { anyAllowedTutorEmail } from "../lib/tutorAllowlist";

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;
function displayName(u: UserRow | undefined, fallback = "Student"): string {
  if (!u) return fallback;
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || u.email || fallback;
}

const CreateLinkBody = z.object({
  studentEmail: z.string().trim().email("Enter a valid email"),
});

router.get("/parent-links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const [links, users] = await Promise.all([
    db.select().from(parentStudentLinksTable).where(eq(parentStudentLinksTable.parentId, req.user.id)),
    db.select().from(usersTable),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(
    links.map((l) => {
      const student = l.studentId ? userMap.get(l.studentId) : undefined;
      return {
        id: l.id,
        studentId: l.studentId,
        studentName: student ? displayName(student) : l.studentName,
        studentEmail: student?.email ?? null,
        // false = a name-only placeholder or a request still awaiting approval
        linked: Boolean(l.studentId) && l.status === "approved",
        status: l.status,
      };
    }),
  );
});

router.post("/parent-links", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }); return; }
  const email = parsed.data.studentEmail.toLowerCase();

  const users = await db.select().from(usersTable);
  const student = users.find((u) => (u.email ?? "").toLowerCase() === email);

  if (!student) {
    res.status(404).json({ error: "No student found with that email. Make sure they've signed up first." });
    return;
  }
  if (student.id === req.user.id) {
    res.status(400).json({ error: "You can't link to your own account." });
    return;
  }
  if (student.role === "tutor" || student.role === "parent") {
    res.status(400).json({ error: `That email belongs to a ${student.role} account, not a student.` });
    return;
  }

  const existing = await db
    .select()
    .from(parentStudentLinksTable)
    .where(and(eq(parentStudentLinksTable.parentId, req.user.id), eq(parentStudentLinksTable.studentId, student.id)))
    .limit(1);
  if (existing.length > 0) {
    const l = existing[0];
    res.json(linkResponse(l, student));
    return;
  }

  // The link starts out pending: knowing a student's email is not enough to see
  // their schedule, feedback and payments. The student or their tutor approves it.
  const [link] = await db
    .insert(parentStudentLinksTable)
    .values({
      tutorId: student.tutorId ?? null,
      parentId: req.user.id,
      studentId: student.id,
      studentName: displayName(student),
      status: "pending",
    })
    .returning();

  res.status(201).json(linkResponse(link, student));
});

type LinkRow = typeof parentStudentLinksTable.$inferSelect;
function linkResponse(l: LinkRow, student: UserRow) {
  return {
    id: l.id,
    studentId: student.id,
    studentName: displayName(student),
    studentEmail: student.email,
    linked: l.status === "approved",
    status: l.status,
  };
}

/**
 * Whether the signed-in user may approve or decline a link request: the
 * student it names, or that student's current tutor.
 */
async function canDecideLink(user: Express.User, link: LinkRow): Promise<boolean> {
  if (!link.studentId) return false;
  if (link.studentId === user.id) return true;
  if (user.role !== "tutor") return false;
  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, link.studentId)).limit(1);
  return student?.tutorId === user.id;
}

// GET /parent-links/requests, pending link requests the caller can approve:
// requests naming them (students), or naming one of their students (tutors).
router.get("/parent-links/requests", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  let studentIds: string[];
  if (req.user.role === "tutor") {
    const students = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.tutorId, req.user.id));
    studentIds = students.map((s) => s.id);
  } else if (req.user.role === "student") {
    studentIds = [req.user.id];
  } else {
    res.json([]);
    return;
  }
  if (studentIds.length === 0) { res.json([]); return; }

  const [pending, users] = await Promise.all([
    db
      .select()
      .from(parentStudentLinksTable)
      .where(and(eq(parentStudentLinksTable.status, "pending"), inArray(parentStudentLinksTable.studentId, studentIds))),
    db.select().from(usersTable),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(
    pending.map((l) => {
      const parent = userMap.get(l.parentId);
      const student = l.studentId ? userMap.get(l.studentId) : undefined;
      return {
        id: l.id,
        parentId: l.parentId,
        parentName: displayName(parent, "Parent"),
        parentEmail: parent?.email ?? null,
        studentId: l.studentId,
        studentName: student ? displayName(student) : l.studentName,
        createdAt: l.createdAt,
      };
    }),
  );
});

router.post("/parent-links/:id/approve", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [link] = await db.select().from(parentStudentLinksTable).where(eq(parentStudentLinksTable.id, id)).limit(1);
  if (!link) { res.status(404).json({ error: "Link request not found" }); return; }
  if (!(await canDecideLink(req.user, link))) {
    res.status(403).json({ error: "Only the student or their tutor can approve this" });
    return;
  }

  const [updated] = await db
    .update(parentStudentLinksTable)
    .set({ status: "approved" })
    .where(eq(parentStudentLinksTable.id, id))
    .returning();
  res.json({ id: updated.id, status: updated.status });
});

router.post("/parent-links/:id/decline", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [link] = await db.select().from(parentStudentLinksTable).where(eq(parentStudentLinksTable.id, id)).limit(1);
  if (!link) { res.status(404).json({ error: "Link request not found" }); return; }
  if (!(await canDecideLink(req.user, link))) {
    res.status(403).json({ error: "Only the student or their tutor can decline this" });
    return;
  }

  // Declining (or revoking an approved link) removes it; the parent can ask again.
  await db.delete(parentStudentLinksTable).where(eq(parentStudentLinksTable.id, id));
  res.json({ success: true });
});

router.delete("/parent-links/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  await db
    .delete(parentStudentLinksTable)
    .where(and(
      eq(parentStudentLinksTable.id, Number(req.params.id)),
      eq(parentStudentLinksTable.parentId, req.user.id),
    ));

  res.json({ success: true });
});

router.post("/auth/set-role", strictRateLimiter, async (req: Request, res: Response) => {
  const { getAuth, clerkClient } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { role, tutorId } = req.body;
  if (role !== "parent" && role !== "student" && role !== "tutor") {
    res.status(400).json({ error: "Role must be parent, student, or tutor" });
    return;
  }

  // A role is picked once, during onboarding. After that it can't be changed
  // from the app (otherwise a student could turn themselves into a parent, or
  // swap tutors at will); repeating the same choice is a harmless no-op.
  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (current && current.role !== "pending" && current.role !== role) {
    res.status(403).json({ error: "Your account type is already set. Contact your tutor to change it.", code: "ROLE_ALREADY_SET" });
    return;
  }

  // The tutor role is restricted to an explicit allowlist of email addresses
  // (TUTOR_EMAILS). This prevents any signed-up student/parent from promoting
  // themselves to tutor.
  if (role === "tutor") {
    const clerkUserForCheck = await clerkClient.users.getUser(userId);
    const allowed = anyAllowedTutorEmail(
      clerkUserForCheck.emailAddresses.map((e) => e.emailAddress),
    );
    if (!allowed) {
      res.status(403).json({
        error: "This email address is not authorized to create a tutor account.",
        code: "INVALID_TUTOR_EMAIL",
      });
      return;
    }
  }

  // Students/parents link to a tutor: use the one provided, else the first tutor.
  let resolvedTutorId: string | null = null;
  if (role !== "tutor" && current?.role === role) {
    // Same-role repeat: keep the tutor already assigned.
    resolvedTutorId = current.tutorId ?? null;
  } else if (role !== "tutor") {
    resolvedTutorId = null;
    if (typeof tutorId === "string" && tutorId) {
      // Only accept an id that really belongs to a tutor.
      const [tutor] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, tutorId), eq(usersTable.role, "tutor")))
        .limit(1);
      if (!tutor) { res.status(400).json({ error: "Unknown tutor" }); return; }
      resolvedTutorId = tutor.id;
    }
    if (!resolvedTutorId) {
      const [firstTutor] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "tutor"))
        .limit(1);
      resolvedTutorId = firstTutor?.id ?? null;
    }
  }

  // The frontend never calls the row-creating /auth/user endpoint, so create
  // (or update) the user's row here when they pick a role during onboarding.
  const clerkUser = await clerkClient.users.getUser(userId);
  await db
    .insert(usersTable)
    .values({
      id: userId,
      username: clerkUser.username,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      profileImageUrl: clerkUser.imageUrl ?? null,
      role,
      tutorId: resolvedTutorId,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { role, tutorId: resolvedTutorId, updatedAt: new Date() },
    });

  const metadata: Record<string, string | null> = { role };
  if (resolvedTutorId && role !== "tutor") metadata.tutorId = resolvedTutorId;
  await clerkClient.users.updateUserMetadata(userId, { publicMetadata: metadata });

  res.json({ success: true, role, tutorId: resolvedTutorId });
});

export default router;
