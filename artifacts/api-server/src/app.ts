import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { apiRateLimiter } from "./middlewares/rateLimit";

const app: Express = express();

// Behind Replit's proxy — trust exactly one hop so req.ip is the real client
// IP (not the proxy), which the rate limiter keys on.
app.set("trust proxy", 1);

// Allowed browser origins. Configure via CORS_ORIGINS (comma-separated);
// defaults to the local dev frontend. Non-browser requests (no Origin header,
// e.g. health checks / server-to-server) are always allowed.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Allow requests with no Origin (curl, health checks, same-origin) and
      // any origin on the allowlist; otherwise omit CORS headers so the
      // browser blocks the cross-origin response.
      cb(null, !origin || allowedOrigins.includes(origin));
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimiter);
app.use(clerkMiddleware());
app.use(authMiddleware);

app.use("/api", router);

export default app;
