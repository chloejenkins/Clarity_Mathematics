import express, { type Express, type Router } from "express";

export type TestUser = Express.User;

/**
 * Mounts a router under /api the way app.ts does, but replaces Clerk +
 * authMiddleware with a fixed signed-in user (or none).
 */
export function testApp(router: Router, user: TestUser | null): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = function (this: express.Request) {
      return this.user != null;
    } as express.Request["isAuthenticated"];
    if (user) req.user = user;
    next();
  });
  app.use("/api", router);
  return app;
}

export const tutorA: TestUser = { id: "tutor-a", role: "tutor", tutorId: null };
export const tutorB: TestUser = { id: "tutor-b", role: "tutor", tutorId: null };
export const studentA: TestUser = { id: "student-a", role: "student", tutorId: "tutor-a" };
export const studentB: TestUser = { id: "student-b", role: "student", tutorId: "tutor-b" };
