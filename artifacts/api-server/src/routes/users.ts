import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListUsersResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db.select().from(usersTable);
  res.json(ListUsersResponse.parse(users));
});

router.patch("/users/me/role", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { role } = req.body;
  if (role !== "tutor" && role !== "student") {
    res.status(400).json({ error: "Role must be tutor or student" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, req.user.id))
    .returning();

  res.json(updated);
});

export default router;
