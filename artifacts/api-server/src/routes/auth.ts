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
      const role = "pending";

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

// Pull the caller's current Clerk profile (name, username, avatar) into our
// users row, so profile-picture / name changes propagate to other users.
router.post("/auth/sync-profile", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    await db
      .update(usersTable)
      .set({
        username: clerkUser.username,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        profileImageUrl: clerkUser.imageUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    res.json({ success: true, profileImageUrl: clerkUser.imageUrl ?? null });
  } catch (err) {
    req.log?.error({ err }, "Failed to sync profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
