#!/usr/bin/env bash
# Stops the processes started by start-stack.sh.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_DIR="${E2E_RUN_DIR:-$ROOT/e2e/.run}"
for name in api web; do
  if [ -f "$RUN_DIR/$name.pid" ]; then
    pid="$(cat "$RUN_DIR/$name.pid")"
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    rm -f "$RUN_DIR/$name.pid"
  fi
done
