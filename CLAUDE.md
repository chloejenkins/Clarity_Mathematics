# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Math Tutor Hub" — a tutoring platform (scheduling, messaging, assignments, video lessons, parent
reports/feedback) built as a pnpm workspace monorepo on Replit's artifact system. Each deployable
unit lives under `artifacts/*` and is registered as a Replit artifact (`.replit-artifact/artifact.toml`);
shared code lives under `lib/*`.

## Commands

- `pnpm run build` — typecheck, then build every package that defines `build`
- `pnpm run typecheck` — `tsc --build` across the whole project-reference graph (see below);
  always run this from the repo root, never `tsc` inside a single package
- `pnpm --filter @workspace/<pkg> run typecheck` — typecheck a single leaf package (only works for
  packages under `artifacts/*` and `scripts`, which have non-composite typecheck scripts)
- `pnpm --filter @workspace/api-server run dev` — run the API server (builds via esbuild, then runs
  `dist/index.mjs`; requires `PORT` and `DATABASE_URL` env vars)
- `pnpm --filter @workspace/tutor-hub run dev` — run the tutor-hub Vite frontend
- `pnpm --filter @workspace/mockup-sandbox run dev` — run the component-preview server (used by the
  Replit design canvas to render individual components in isolation; not part of the shipped app)
- `pnpm --filter db run push` — push Drizzle schema changes to the database (`push-force` if `push`
  refuses due to data loss warnings)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate `api-client-react` and `api-zod` from
  `lib/api-spec/openapi.yaml`
- There is no test suite/runner configured in this repo yet.
- Only `pnpm` is allowed — the root `preinstall` script hard-fails on npm/yarn.

## Architecture

### TypeScript project references

Every package extends `tsconfig.base.json` (`composite: true`). The root `tsconfig.json` lists every
package as a project reference and `pnpm run typecheck` runs `tsc --build --emitDeclarationOnly` over
that graph — this is what makes cross-package imports (e.g. `@workspace/db` in `api-server`) resolve.
When package A imports package B, A's `tsconfig.json` must list B under `references`. `tsc` only emits
`.d.ts` files here; actual bundling is done by esbuild (api-server) or Vite (frontends).

### API contract flow (spec-first, not code-first)

`lib/api-spec/openapi.yaml` is the source of truth for the HTTP API. Orval codegen
(`lib/api-spec/orval.config.ts`) generates two downstream packages from it:

- `lib/api-zod/src/generated/` — Zod schemas per type (e.g. `HealthCheckResponse`), used by
  `api-server` routes to validate/parse responses before sending them
- `lib/api-client-react/src/generated/` — React Query hooks + fetch client, consumed by the
  `tutor-hub` frontend

When changing an API route's request/response shape, edit `openapi.yaml` first, then run codegen,
then update the route handler and any frontend callers — don't hand-edit files under `generated/`.

### `artifacts/api-server` (Express 5)

- `src/app.ts` — middleware pipeline: pino request logging → CORS → cookies → JSON/urlencoded body
  parsing → Clerk auth (`clerkMiddleware()`) → app-specific `authMiddleware` → routes mounted at `/api`
- `src/middlewares/authMiddleware.ts` — after Clerk resolves `userId`, looks up the corresponding row
  in `usersTable` and attaches it to `req.user` (adds `Request.isAuthenticated()` and augments
  `Express.User`/`Express.Request` via global augmentation)
- `src/routes/auth.ts` (`GET /api/auth/user`) — lazily creates a `usersTable` row (role `"pending"`)
  the first time a Clerk-authenticated user is seen, and mirrors `role`/`tutorId` into Clerk's
  `publicMetadata` so the frontend can read it off the Clerk user object without an extra API call
- `src/routes/index.ts` mounts one router per resource (`sessions`, `messages`, `assignments`,
  `videos`, `users`, `availability`, `parentFeedback`, `parentLinks`, `health`)
- `src/lib/auth.ts` contains Replit-OIDC session helpers (`createSession`/`getSession` against
  `sessionsTable`) that predate the Clerk migration and are not wired into `app.ts` — auth is
  Clerk-only in the current pipeline
- Auth model: Clerk is the identity provider; `role` (`tutor` | `student` | `parent` | `pending`) and
  `tutorId` are app-level state stored in Postgres and synced into Clerk `publicMetadata`
- Build: `build.mjs` bundles the server with esbuild into a single `dist/index.mjs` (ESM), with a
  large external-package allowlist for native/unbundleable deps and a banner that polyfills
  `require`/`__dirname` for CJS deps pulled into the ESM bundle
- Health check: `GET /api/healthz` (used by Replit's production health check, see `artifact.toml`)

### `lib/db` (Drizzle ORM + PostgreSQL)

- `src/schema/auth.ts` — `sessionsTable` and `usersTable`. Both are marked "mandatory for Replit
  Auth, don't drop" even though live auth now goes through Clerk; `sessionsTable` is still used by
  the legacy `lib/auth.ts` helpers above
- `src/schema/tutoring.ts` — domain tables: `tutoringSessionsTable`, `messagesTable`,
  `assignmentsTable`, `videosTable`, `availabilitySlotsTable`, `submissionsTable`,
  `parentStudentLinksTable`, `parentFeedbackTable`. Each has a matching `drizzle-zod` insert schema
  (`insertXSchema`) generated with `createInsertSchema`, omitting server-assigned columns
- No migration files are checked in — schema changes are applied directly via `drizzle-kit push`
  (dev) or handled by Replit at publish time (production)

### `artifacts/tutor-hub` (React 19 + Vite frontend)

- Routing via `wouter`, not react-router (`src/App.tsx`)
- Auth: Clerk React SDK (`@clerk/clerk-react`) for sign-in state; `@workspace/replit-auth-web`
  wraps Clerk's `useUser`/`useClerk` behind a `useAuth()` hook that also exposes app-level
  `role`/`tutorId` read from Clerk `publicMetadata` — despite the package name, this is Clerk-backed,
  not Replit-session-backed
- `ProtectedRoute` in `App.tsx` gates every real page behind Clerk sign-in and redirects users whose
  `role` is still `"pending"` to `/onboarding`
- API calls go through generated React Query hooks in `@workspace/api-client-react`; the Clerk
  session token is wired into the fetch client via `setAuthTokenGetter` (see `ClerkTokenProvider` in
  `App.tsx`), not via cookies
- `src/components/ui/*` is a shadcn/ui-style component set — check here before adding a new primitive
- Env: `VITE_CLERK_PUBLISHABLE_KEY` is provided via Replit's `userenv` (see `.replit`)

### `artifacts/mockup-sandbox`

A separate Vite app used only by the Replit design canvas to render individual components in
isolation (`kind = "design"` in its `artifact.toml`, served at `/__mockup`). New components dropped
into `src/components/mockups/**/*.tsx` (any name not starting with `_`) are auto-discovered by the
custom `mockupPreviewPlugin.ts` Vite plugin, which regenerates `src/.generated/mockup-components.ts`
(a dynamic-import map) on file add/remove and serves them at `/__mockup/preview/<ComponentPath>`. This
package shares the same `components/ui` primitives as `tutor-hub` but is otherwise independent of the
shipped app.

### `lib/api-client-react/src/custom-fetch.ts`

Shared fetch wrapper used by all Orval-generated hooks. Supports a settable base URL
(`setBaseUrl`, for non-web runtimes like Expo) and a settable bearer-token getter
(`setAuthTokenGetter`, used for Clerk tokens on web). Distinguishes `ApiError` (non-2xx HTTP
response) from `ResponseParseError` (2xx response whose body isn't valid JSON) — check `error.status`
vs. expecting a parse failure accordingly.

### Replit-specific integration points

- `.replit` declares three artifacts (`api-server`, `mockup-sandbox`; `tutor-hub` is registered via
  its own `artifact.toml`) and a `postMerge` hook (`scripts/post-merge.sh`) that runs
  `pnpm install --frozen-lockfile && pnpm --filter db run push` after every merge
- Each artifact's `.replit-artifact/artifact.toml` defines its dev run command, production build/run
  command, and (for api-server) the production health-check path — check these before assuming how a
  package is actually started in deployment
- `scripts/` (`@workspace/scripts`) is a workspace package for one-off/utility `.ts` scripts, each
  exposed as an npm script and run via `pnpm --filter @workspace/scripts run <script>`
