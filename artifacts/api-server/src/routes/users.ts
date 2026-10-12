import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { ListUsersResponse } from "@workspace/api-zod";
import { contactIdsFor } from "../lib/contacts";

const router: IRouter = Router();

// GET /users, only the people the caller is actually related to (their tutor,
// their students, and linked parents/children). NOT the entire user base.
router.get("/users", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const ids = await contactIdsFor(req.user);

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
