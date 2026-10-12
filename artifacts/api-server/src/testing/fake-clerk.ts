// Test-only stand-in for "@clerk/express", used by the e2e harness (see /e2e).
//
// It is never imported by source code directly: build.mjs aliases
// "@clerk/express" to this file only when E2E_AUTH_BYPASS=1, so normal and
// production bundles contain the real Clerk SDK and none of this code.
//
// Identity comes from a bearer token (or the `__session` cookie, mirroring how
// Clerk's own session cookie works for plain `fetch(..., {credentials})`
// calls) of the form `e2e.<base64url JSON {id,email,firstName,lastName}>`.
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

if (process.env.NODE_ENV === "production") {
  throw new Error("fake-clerk must never be bundled into a production build");
}

interface Identity {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

const identities = new Map<string, Identity>();
const metadata = new Map<string, Record<string, unknown>>();

function parseToken(raw: string | undefined): Identity | null {
  if (!raw || !raw.startsWith("e2e.")) return null;
  try {
    const json = JSON.parse(Buffer.from(raw.slice(4), "base64url").toString("utf8"));
    if (typeof json?.id !== "string" || typeof json?.email !== "string") return null;
    return json as Identity;
  } catch {
    return null;
  }
}

function tokenFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return (req as Request & { cookies?: Record<string, string> }).cookies?.__session;
}

export function getAuth(req: Request): { userId: string | null } {
  const identity = parseToken(tokenFrom(req));
  if (!identity) return { userId: null };
  identities.set(identity.id, identity);
  return { userId: identity.id };
}

async function publicMetadataFor(userId: string): Promise<Record<string, unknown>> {
  const stored = metadata.get(userId);
  if (stored) return stored;
  // After an API restart the in-memory store is empty; rebuild it from the
  // users row, which the real code keeps in sync with Clerk metadata.
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!row) return {};
  return row.role === "tutor" ? { role: row.role } : { role: row.role, tutorId: row.tutorId };
}

async function getUser(userId: string) {
  const identity = identities.get(userId);
  if (!identity) throw new Error(`fake-clerk: unknown user ${userId}`);
  return {
    id: identity.id,
    username: identity.username ?? null,
    firstName: identity.firstName ?? null,
    lastName: identity.lastName ?? null,
    imageUrl: "",
    emailAddresses: [{ emailAddress: identity.email }],
    publicMetadata: await publicMetadataFor(userId),
  };
}

export const clerkClient = {
  users: {
    getUser,
    async updateUserMetadata(userId: string, params: { publicMetadata?: Record<string, unknown> }) {
      metadata.set(userId, { ...(metadata.get(userId) ?? {}), ...(params.publicMetadata ?? {}) });
      return getUser(userId);
    },
  },
};

// Stands in for Clerk's Frontend API: the fake browser SDK loads the signed-in
// user (including publicMetadata) from here. The harness also calls the reset
// route after emptying the database, so stale metadata can't outlive it.
export function clerkMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "POST" && req.path === "/api/__e2e/reset") {
      identities.clear();
      metadata.clear();
      res.json({ success: true });
      return;
    }
    if (req.method === "GET" && req.path === "/api/__e2e/clerk-user") {
      const { userId } = getAuth(req);
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      res.json(await getUser(userId));
      return;
    }
    next();
  };
}
