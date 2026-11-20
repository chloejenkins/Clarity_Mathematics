#!/usr/bin/env bash
# Starts the preview site inside its container (see preview/Dockerfile):
#   1. a fresh, empty Postgres that lives only inside this container
#   2. the app's tables (drizzle push)
#   3. the demo people, lessons, homework, chats and payments (seed-demo.ts)
#   4. the site itself on $PORT
# Everything starts from scratch each time the container starts, so the
# preview resets to the same demo data after every update or idle sleep.
set -euo pipefail
cd /app

PGDATA=/tmp/pgdata
DB_NAME=clarity_preview_e2e   # "e2e" lets the demo seeder's safety check through
export DATABASE_URL="postgres://postgres@127.0.0.1:5432/$DB_NAME"

echo "Starting the preview database…"
rm -rf "$PGDATA" && mkdir -p "$PGDATA" && chown postgres:postgres "$PGDATA"
gosu postgres initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
gosu postgres pg_ctl -D "$PGDATA" -l /tmp/postgres.log -w start \
  -o "-c listen_addresses=127.0.0.1 -c shared_buffers=32MB -c max_connections=40 -c fsync=off -c synchronous_commit=off -c full_page_writes=off"
gosu postgres createdb -h 127.0.0.1 -U postgres "$DB_NAME"

echo "Creating tables…"
pnpm --filter db run push-force >/tmp/db-push.log 2>&1 || { cat /tmp/db-push.log; exit 1; }

SITE="${RENDER_EXTERNAL_URL:-http://localhost:$PORT}"
export NODE_ENV=development   # the demo sign-in refuses to run in production mode
export STATIC_DIR=/app/artifacts/tutor-hub/dist/public
export UPLOADS_DIR=/tmp/uploads
export CORS_ORIGINS="$SITE,http://localhost:$PORT"
export TUTOR_EMAILS="${TUTOR_EMAILS:-tutor@claritymathematics.com}"
SERVER=/app/artifacts/api-server/dist/index.mjs

echo "Adding demo data…"
# A private copy of the API on an internal port fills the database, so the
# public site only opens once everything is in place.
PORT=3001 node "$SERVER" >/tmp/seed-api.log 2>&1 &
SEED_PID=$!
for _ in $(seq 1 60); do
  node -e 'fetch("http://127.0.0.1:3001/api/healthz").then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))' && break
  sleep 1
done
(cd e2e && E2E_API_URL=http://127.0.0.1:3001 E2E_WEB_URL="$SITE" pnpm exec tsx scripts/seed-demo.ts) \
  || { cat /tmp/seed-api.log; exit 1; }
kill "$SEED_PID" && wait "$SEED_PID" 2>/dev/null || true

echo "Preview site is starting on port $PORT ($SITE)"
exec node --enable-source-maps "$SERVER"
