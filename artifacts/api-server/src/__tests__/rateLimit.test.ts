import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

// The limiters keep their counters in module-level memory stores, so each
// test re-imports the module to start from a clean slate.
let limiters: typeof import("../middlewares/rateLimit");
beforeEach(async () => {
  vi.resetModules();
  limiters = await import("../middlewares/rateLimit");
});

/** App with one limiter in front of a trivial handler; `x-user` sets req.user. */
function appWith(limiter: RequestHandler) {
  const app = express();
  app.use((req, _res, next) => {
    const id = req.header("x-user");
    if (id) req.user = { id, role: "student" };
    next();
  });
  app.use(limiter);
  app.all("/{*path}", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

async function hit(app: express.Express, times: number, path = "/api/sessions", user?: string) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) {
    const req = request(app).get(path);
    if (user) req.set("x-user", user);
    statuses.push((await req).status);
  }
  return statuses;
}

describe("apiRateLimiter (global, per IP)", () => {
  it("allows 120 requests a minute, then returns 429 with a JSON error", async () => {
    const app = appWith(limiters.apiRateLimiter);
    const statuses = await hit(app, 120);
    expect(statuses.every((s) => s === 200)).toBe(true);

    const blocked = await request(app).get("/api/sessions");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests, please try again shortly." });
    expect(blocked.headers["ratelimit-policy"]).toBe("120;w=60");
  });

  it("never throttles the health check", async () => {
    const app = appWith(limiters.apiRateLimiter);
    await hit(app, 120);
    expect((await request(app).get("/api/sessions")).status).toBe(429);
    const health = await hit(app, 5, "/api/healthz");
    expect(health).toEqual([200, 200, 200, 200, 200]);
  });
});

describe("strictRateLimiter (sensitive writes, per user)", () => {
  it("allows 30 requests a minute per user, then returns 429", async () => {
    const app = appWith(limiters.strictRateLimiter);
    const statuses = await hit(app, 30, "/api/messages", "user-a");
    expect(statuses.every((s) => s === 200)).toBe(true);

    const blocked = await request(app).get("/api/messages").set("x-user", "user-a");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "You're doing that too fast, please slow down." });
  });

  it("counts each signed-in user separately, even from the same IP", async () => {
    const app = appWith(limiters.strictRateLimiter);
    await hit(app, 31, "/api/messages", "user-a");
    expect((await request(app).get("/api/messages").set("x-user", "user-b")).status).toBe(200);
  });

  it("falls back to the client IP for signed-out requests", async () => {
    const app = appWith(limiters.strictRateLimiter);
    const statuses = await hit(app, 31, "/api/auth/set-role");
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    // A signed-in user on the same IP still has their own budget.
    expect((await request(app).get("/api/messages").set("x-user", "user-a")).status).toBe(200);
  });
});

describe("strictRateLimiter wiring", () => {
  type Layer = {
    route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  };

  function guarded(router: { stack: Layer[] }, method: string, path: string) {
    const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
    expect(layer, `${method.toUpperCase()} ${path} exists`).toBeDefined();
    return layer!.route!.stack.some((h) => h.handle === limiters.strictRateLimiter);
  }

  it.each([
    ["messages", "post", "/messages"],
    ["conversations", "post", "/conversations"],
    ["conversations", "post", "/conversations/:id/messages"],
    ["auth", "post", "/auth/sync-profile"],
    ["parentLinks", "post", "/auth/set-role"],
  ])("routes/%s %s %s is behind the strict limiter", async (mod, method, path) => {
    vi.stubEnv("UPLOADS_DIR", "/tmp/api-server-test-uploads");
    const router = (await import(`../routes/${mod}.ts`)).default as unknown as { stack: Layer[] };
    expect(guarded(router, method, path)).toBe(true);
  });
});
