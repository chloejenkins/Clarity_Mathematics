#!/usr/bin/env bash
# Builds the API with the fake Clerk, pushes the schema to the test database,
# and starts the API (port 3001) and the tutor-hub Vite dev server (port 5173)
# in the background. Logs and PIDs go to $E2E_RUN_DIR (default: e2e/.run).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_DIR="${E2E_RUN_DIR:-$ROOT/e2e/.run}"
mkdir -p "$RUN_DIR"

: "${DATABASE_URL:?Set DATABASE_URL to a throwaway Postgres database (its name must contain e2e or test)}"
case "$DATABASE_URL" in
  *e2e*|*test*) ;;
  *) echo "Refusing to run: DATABASE_URL must point at a database whose name contains e2e or test" >&2; exit 1 ;;
esac

export NODE_ENV=development
export TUTOR_EMAILS="${TUTOR_EMAILS:-tutor@claritymathematics.com}"

"$ROOT/e2e/scripts/stop-stack.sh" >/dev/null 2>&1 || true

(cd "$ROOT" && pnpm --filter db run push-force >"$RUN_DIR/db-push.log" 2>&1)
(cd "$ROOT/artifacts/api-server" && E2E_AUTH_BYPASS=1 node build.mjs >"$RUN_DIR/api-build.log" 2>&1)

(cd "$ROOT/artifacts/api-server" && \
  PORT=3001 UPLOADS_DIR="$RUN_DIR/uploads" CORS_ORIGINS=http://localhost:5173 \
  nohup node --enable-source-maps dist/index.mjs >"$RUN_DIR/api.log" 2>&1 & echo $! >"$RUN_DIR/api.pid")

(cd "$ROOT/artifacts/tutor-hub" && \
  PORT=5173 BASE_PATH=/ VITE_E2E_AUTH=1 VITE_CLERK_PUBLISHABLE_KEY=pk_test_e2e \
  nohup pnpm exec vite --config vite.config.ts --host 127.0.0.1 >"$RUN_DIR/web.log" 2>&1 & echo $! >"$RUN_DIR/web.pid")

for _ in $(seq 1 60); do
  if curl -sf http://localhost:3001/api/healthz >/dev/null && curl -sf http://localhost:5173/ >/dev/null; then
    echo "Stack is up: web http://localhost:5173, api http://localhost:3001"
    exit 0
  fi
  sleep 1
done
echo "Stack did not come up; see $RUN_DIR/*.log" >&2
exit 1
