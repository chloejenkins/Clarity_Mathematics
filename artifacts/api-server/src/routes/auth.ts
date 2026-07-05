import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/auth/user", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.json({ authenticated: false, user: undefined });
    return;
  }

  try {
    let [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (!dbUser) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const isFirstUser = (await db.select().from(usersTable)).length === 0;
      const role = isFirstUser ? "tutor" : "pending";

      const userData = {
        id: userId,
        username: clerkUser.username,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        profileImageUrl: clerkUser.imageUrl ?? null,
        role,
      };

      [dbUser] = await db
        .insert(usersTable)
        .values(userData)
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { ...userData, updatedAt: new Date() },
        })
        .returning();

      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { role },
      });
    }

    res.json({
      authenticated: true,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImageUrl: dbUser.profileImageUrl,
        role: dbUser.role,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to get/create user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
