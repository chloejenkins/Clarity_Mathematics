import { db, usersTable, parentStudentLinksTable } from "@workspace/db";
import { eq, or, and, inArray } from "drizzle-orm";

type ContactUser = Pick<Express.User, "id" | "role" | "tutorId">;

/**
 * Ids of the people a user is actually related to: their tutor, their
 * students, and approved parent/child links (plus the tutor of a linked
 * child). Always includes the user's own id. Used to scope the user list and
 * to decide who a user may message.
 */
export async function contactIdsFor(me: ContactUser): Promise<Set<string>> {
  const ids = new Set<string>([me.id]);

  // Approved parent-student links directly involving me.
  const myLinks = await db
    .select()
    .from(parentStudentLinksTable)
    .where(
      and(
        eq(parentStudentLinksTable.status, "approved"),
        or(
          eq(parentStudentLinksTable.parentId, me.id),
          eq(parentStudentLinksTable.studentId, me.id),
        ),
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
        .where(
          and(
            eq(parentStudentLinksTable.status, "approved"),
            inArray(parentStudentLinksTable.studentId, studentIds),
          ),
        );
      parentLinks.forEach((l) => ids.add(l.parentId));
    }
  } else {
    // Student/parent: include my tutor, and the tutor of any linked child.
    if (me.tutorId) ids.add(me.tutorId);
    const linkedStudentIds = myLinks
      .map((l) => l.studentId)
      .filter((v): v is string => Boolean(v));
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

  return ids;
}

/** Whether `me` may start a conversation with / message every one of `otherIds`. */
export async function canContactAll(me: ContactUser, otherIds: string[]): Promise<boolean> {
  const contacts = await contactIdsFor(me);
  return otherIds.every((id) => id !== me.id && contacts.has(id));
}
