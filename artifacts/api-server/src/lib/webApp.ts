import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

// Serves the built tutor-hub frontend from the API server, so the whole site
// (web pages + /api) runs as one service on one domain in production.
//
// Enabled only when STATIC_DIR points at a Vite build output (the folder that
// holds index.html, e.g. artifacts/tutor-hub/dist/public). On Replit and in
// local dev STATIC_DIR is unset and nothing changes.
//
// Returns true when the frontend was mounted.
export function mountWebApp(app: Express, staticDir: string | undefined): boolean {
  if (!staticDir) return false;

  const root = path.resolve(staticDir);
  const indexHtml = path.join(root, "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error(
      `STATIC_DIR is set to "${staticDir}" but ${indexHtml} does not exist. Build the frontend first.`,
    );
  }

  // Vite fingerprints everything under /assets, so those can be cached for a
  // long time. Everything else (index.html, favicon, images) revalidates.
  app.use(
    express.static(root, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.startsWith(path.join(root, "assets") + path.sep)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // Client-side routing (wouter): any other GET that isn't an API call gets
  // index.html, and the frontend decides what to show.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });

  return true;
}
