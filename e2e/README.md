# Clarity e2e harness

Browser tests that use the site the way its three kinds of people do (the tutor, a student, a parent), plus an
outsider from another family who checks that nothing leaks between families. Every run also writes an audit report
of the bugs, privacy problems and missing features it ran into.

There are two layers:

- **Scripted journeys** (`specs/`, Playwright). These are repeatable flows: onboarding, scheduling and booking,
  assignments and review, chat, payments, parent reports, and privacy checks. They run in file order on one
  worker against a shared database, because each step builds on the previous one (the tutor posts times, then the
  student books one, and so on).
- **AI explorer** (`agent/`). Claude is given a persona and a goal (for example, "you're a busy parent; find out what
  homework your child has and pay what you owe"). It drives a real browser through the site with a small set of
  tools (look, click, fill, attach a file) and reports whatever gets in its way. Missions live in
  `agent/missions.ts`.

## How sign-in works in tests

Real sign-in goes through Clerk, which a headless browser can't complete. In test mode only, both apps swap the
Clerk SDK for a small fake:

- `artifacts/api-server/build.mjs` aliases `@clerk/express` to `src/testing/fake-clerk.ts` when
  `E2E_AUTH_BYPASS=1`. The fake reads the persona from a `Bearer e2e.<base64 JSON>` token or the `__session`
  cookie, and refuses to load when `NODE_ENV=production`.
- `artifacts/tutor-hub/vite.config.ts` aliases `@clerk/clerk-react` to `src/testing/fake-clerk.tsx` when
  `VITE_E2E_AUTH=1`. The fake reads the persona from `localStorage["e2e-identity"]`.

Without those variables, builds are unchanged and contain no test code. Everything after sign-in (the users table,
roles, the tutor allowlist, every route's permission checks) is the real code.

## Running it

You need Postgres and a throwaway database whose name contains `e2e` or `test` (the scripts refuse anything else,
and the suite empties every table at the start of each run).

```sh
pnpm install
export DATABASE_URL=postgres://postgres@localhost:5432/clarity_e2e

e2e/scripts/start-stack.sh                    # pushes the schema, starts API :3001 and web :5173
pnpm --filter @workspace/e2e test             # scripted journeys
pnpm --filter @workspace/e2e run explore -- all   # AI explorer (needs ANTHROPIC_API_KEY); or one mission name
e2e/scripts/stop-stack.sh
```

Outputs:

- `e2e/reports/findings.md` (and `.json`): every finding the journeys recorded, grouped by severity.
- `e2e/reports/agent-<mission>.md`: what each explorer run found.
- `e2e/playwright-report/`: Playwright's HTML report, with traces for failures.

Browsers and test code run in `America/New_York` by default (set `TZ` to change it), so date handling is checked the
way US families see it. Set `CHROMIUM_PATH` if Playwright's own Chromium isn't installed.

## Findings versus failures

A failing test means a journey a person relies on is broken. A **finding** is something worth fixing that doesn't
stop the journey, recorded with `finding()` or `expectRule()` from `lib/findings.ts`. `expectRule()` checks a rule
the app should follow; while the app breaks it, the check records a finding and the test still passes. Once the app
is fixed the finding disappears from the report on its own, so the report always reflects the current code.
