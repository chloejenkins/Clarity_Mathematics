import { db, parentStudentLinksTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";

/** Student ids of a parent's approved, linked children. */
export async function linkedStudentIds(parentId: string): Promise<string[]> {
  const links = await db
    .select({ studentId: parentStudentLinksTable.studentId })
    .from(parentStudentLinksTable)
    .where(and(
      eq(parentStudentLinksTable.parentId, parentId),
      eq(parentStudentLinksTable.status, "approved"),
      isNotNull(parentStudentLinksTable.studentId),
    ));
  return links.map((l) => l.studentId).filter((v): v is string => Boolean(v));
}

/**
 * Whether `user` is the person `studentId` refers to, or a parent with an
 * approved link to them. This is the "family side" of a session, assignment
 * or charge (as opposed to the tutor side).
 */
export async function isSelfOrLinkedParent(
  user: Pick<Express.User, "id" | "role">,
  studentId: string | null | undefined,
): Promise<boolean> {
  if (!studentId) return false;
  if (studentId === user.id) return true;
  if (user.role !== "parent") return false;
  return (await linkedStudentIds(user.id)).includes(studentId);
}
