import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mountWebApp } from "../lib/webApp";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "webapp-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Clarity</title>");
  fs.mkdirSync(path.join(dir, "assets"));
  fs.writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log(1)");
  fs.writeFileSync(path.join(dir, "favicon.svg"), "<svg/>");
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function appWithWeb(staticDir: string | undefined) {
  const app = express();
  const mounted = mountWebApp(app, staticDir);
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found" });
  });
  return { app, mounted };
}

describe("mountWebApp", () => {
  it("does nothing when STATIC_DIR is unset", async () => {
    const { app, mounted } = appWithWeb(undefined);
    expect(mounted).toBe(false);
    const res = await request(app).get("/dashboard");
    expect(res.status).toBe(404);
  });

  it("refuses to start when the build output is missing", () => {
    expect(() => mountWebApp(express(), path.join(dir, "nope"))).toThrow(/index\.html/);
  });

  it("serves index.html for the root and for client-side routes", async () => {
    const { app } = appWithWeb(dir);
    for (const url of ["/", "/dashboard", "/sessions/42"]) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.text).toContain("<title>Clarity</title>");
      expect(res.headers["cache-control"]).toBe("no-cache");
    }
  });

  it("serves fingerprinted assets with a long cache and other files with revalidation", async () => {
    const { app } = appWithWeb(dir);
    const asset = await request(app).get("/assets/app-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers["cache-control"]).toContain("immutable");

    const icon = await request(app).get("/favicon.svg");
    expect(icon.status).toBe(200);
    expect(icon.headers["cache-control"]).toBe("no-cache");
  });

  it("leaves /api requests to the API, including unknown ones", async () => {
    const { app } = appWithWeb(dir);
    const ok = await request(app).get("/api/healthz");
    expect(ok.body).toEqual({ status: "ok" });

    const missing = await request(app).get("/api/does-not-exist");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "not found" });
  });

  it("does not answer non-GET requests with the page", async () => {
    const { app } = appWithWeb(dir);
    const res = await request(app).post("/dashboard");
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("<title>Clarity</title>");
  });
});
