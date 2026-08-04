import { rateLimit } from "express-rate-limit";

// Global IP-based limiter. Generous enough for normal use, but caps floods.
// Runs before Clerk auth so abusive traffic is rejected before the (relatively
// expensive) token verification.
export const apiRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 120, // 120 requests per IP per minute
  standardHeaders: "draft-7", // adds RateLimit-* response headers
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly." },
  // Never throttle the production health probe. This runs at the app level
  // (before the "/api" mount), so req.path is the full "/api/healthz".
  skip: (req) => req.path.endsWith("/healthz"),
});
