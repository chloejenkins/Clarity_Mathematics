#!/usr/bin/env bash
# One command to preview the whole site locally with realistic demo data.
#
#   e2e/scripts/demo.sh
#
# Starts the API and website (like start-stack.sh, with the "Preview as" picker
# turned on), fills the test database with a tutor, students, a parent and
# their lessons, homework, chats, reports and payments, then prints the link.
# Run it again any time to start over with fresh data. Stop with
# e2e/scripts/stop-stack.sh.
#
# DATABASE_URL defaults to a local database called clarity_e2e owned by you.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgres://$(whoami)@localhost:5432/clarity_e2e}"
export VITE_DEMO=1

echo "Starting Clarity (this takes about a minute)…"
"$ROOT/e2e/scripts/start-stack.sh"

echo "Adding demo data…"
(cd "$ROOT/e2e" && pnpm exec tsx scripts/seed-demo.ts)

echo
echo "All set. Open http://localhost:5173 and click \"Preview as\" (top of the page) to switch between people."
