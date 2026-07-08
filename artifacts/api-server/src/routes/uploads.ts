import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { db, attachmentsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

// Local-disk storage. Configurable via UPLOADS_DIR; defaults to <cwd>/uploads.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/heic",
  "text/plain", "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
});

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;
function displayName(u: UserRow | undefined): string {
  if (!u) return "Unknown";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || u.email || "User";
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// Wrap multer so its errors become clean 400s instead of crashing the request.
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const code = (err as { code?: string }).code;
      res.status(400).json({
        error: code === "LIMIT_FILE_SIZE" ? "File too large (max 15 MB)" : "Upload failed",
      });
      return;
    }
    next();
  });
}

/** Resolve which tutor a file should be routed to. */
async function resolveTutorId(user: Express.User): Promise<string | null> {
  if (user.role === "tutor") return user.id;
  if (user.tutorId) return user.tutorId;
  const [t] = await db.select().from(usersTable).where(eq(usersTable.role, "tutor")).limit(1);
  return t?.id ?? null;
}

async function hydrate(rows: (typeof attachmentsTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((a) => ({
    id: a.id,
    assignmentId: a.assignmentId,
    uploadedBy: a.uploadedBy,
    uploaderName: displayName(userMap.get(a.uploadedBy)),
    uploaderRole: userMap.get(a.uploadedBy)?.role ?? null,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    note: a.note,
    createdAt: a.createdAt,
    downloadUrl: `/api/uploads/${a.id}/download`,
  }));
}

// POST /uploads — multipart: file (required), assignmentId? (attach to assignment), note?
router.post("/uploads", requireAuth, uploadSingle, async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No valid file. Allowed: PDF, images, Office docs, text, zip." });
    return;
  }
  const rawId = req.body?.assignmentId;
  const assignmentId = rawId != null && rawId !== "" ? Number(rawId) : null;
  const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 1000) : null;
  const tutorId = await resolveTutorId(req.user);

  const [row] = await db
    .insert(attachmentsTable)
    .values({
      assignmentId: assignmentId != null && Number.isInteger(assignmentId) ? assignmentId : null,
      uploadedBy: req.user.id,
      tutorId,
      filename: req.file.originalname,
      storageKey: req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      note,
    })
    .returning();

  const [hydrated] = await hydrate([row]);
  res.status(201).json(hydrated);
});

// GET /uploads?assignmentId= — files the current user can see.
router.get("/uploads", requireAuth, async (req: Request, res: Response) => {
  const assignmentId = req.query.assignmentId ? Number(req.query.assignmentId) : undefined;
  const conds = [];
  if (req.user.role === "tutor") {
    conds.push(eq(attachmentsTable.tutorId, req.user.id));
  } else {
    conds.push(eq(attachmentsTable.uploadedBy, req.user.id));
  }
  if (assignmentId != null && Number.isInteger(assignmentId)) {
    conds.push(eq(attachmentsTable.assignmentId, assignmentId));
  }
  const rows = await db
    .select()
    .from(attachmentsTable)
    .where(conds.length > 1 ? and(...conds) : conds[0])
    .orderBy(desc(attachmentsTable.createdAt));
  res.json(await hydrate(rows));
});

// GET /uploads/:id/download — stream the file (auth-checked).
router.get("/uploads/:id/download", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [att] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, id)).limit(1);
  if (!att) { res.status(404).json({ error: "Not found" }); return; }

  const canAccess =
    att.uploadedBy === req.user.id ||
    att.tutorId === req.user.id ||
    req.user.role === "tutor";
  if (!canAccess) { res.status(403).json({ error: "Forbidden" }); return; }

  const filePath = path.join(UPLOADS_DIR, att.storageKey);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File missing on server" }); return; }

  res.setHeader("Content-Type", att.mimeType ?? "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
  );
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /uploads/:id — uploader or a tutor may remove.
router.delete("/uploads/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [att] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, id)).limit(1);
  if (!att) { res.status(404).json({ error: "Not found" }); return; }
  if (att.uploadedBy !== req.user.id && req.user.role !== "tutor") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(attachmentsTable).where(eq(attachmentsTable.id, id));
  fs.rm(path.join(UPLOADS_DIR, att.storageKey), { force: true }, () => {});
  res.json({ success: true });
});

export default router;
