import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { apiRateLimiter } from "./middlewares/rateLimit";
import { mountWebApp } from "./lib/webApp";

const app: Express = express();

// Behind the host's proxy, trust that many hops so req.ip is the real client
// IP (not the proxy), which the rate limiter keys on. Defaults to 1 (Replit);
// set TRUST_PROXY_HOPS if a host puts more proxies in front of the app.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
app.set("trust proxy", Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);

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
// In production on a single host, the API server also serves the built web
// pages (see lib/webApp.ts). Mounted before CORS, rate limiting and Clerk so
// page and asset loads skip them; /api requests fall through to the router.
mountWebApp(app, process.env.STATIC_DIR);

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
