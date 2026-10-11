import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { parentStudentLinksTable } from "@workspace/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { ListUsersResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /users, only the people the caller is actually related to (their tutor,
// their students, and linked parents/children). NOT the entire user base.
router.get("/users", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = req.user;
  const ids = new Set<string>([me.id]);

  // Parent-student links directly involving me.
  const myLinks = await db
    .select()
    .from(parentStudentLinksTable)
    .where(
      or(
        eq(parentStudentLinksTable.parentId, me.id),
        eq(parentStudentLinksTable.studentId, me.id),
      ),
    );
  for (const l of myLinks) {
    ids.add(l.parentId);
    if (l.studentId) ids.add(l.studentId);
  }

  if (me.role === "tutor") {
    // My students, plus the parents linked to them.
    const students = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.tutorId, me.id));
    const studentIds = students.map((s) => s.id);
    studentIds.forEach((id) => ids.add(id));
    if (studentIds.length > 0) {
      const parentLinks = await db
        .select()
        .from(parentStudentLinksTable)
        .where(inArray(parentStudentLinksTable.studentId, studentIds));
      parentLinks.forEach((l) => ids.add(l.parentId));
    }
  } else {
    // Student/parent: include my tutor, and the tutor of any linked child.
    if (me.tutorId) ids.add(me.tutorId);
    const linkedStudentIds = myLinks
      .map((l) => l.studentId)
      .filter((id): id is string => Boolean(id));
    if (linkedStudentIds.length > 0) {
      const linkedStudents = await db
        .select({ tutorId: usersTable.tutorId })
        .from(usersTable)
        .where(inArray(usersTable.id, linkedStudentIds));
      linkedStudents.forEach((s) => {
        if (s.tutorId) ids.add(s.tutorId);
      });
    }
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, [...ids]));
  res.json(ListUsersResponse.parse(rows));
});

// Public-ish tutor listing for onboarding (requires auth so pending users can call it).
router.get("/users/tutors", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const tutors = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      username: usersTable.username,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "tutor"));

  res.json(tutors);
});

export default router;
