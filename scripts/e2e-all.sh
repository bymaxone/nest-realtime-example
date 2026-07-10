#!/usr/bin/env sh
# Runs every end-to-end suite in one memory-safe order, one suite at a time:
# the in-process HTTP/SSE/WebSocket suites, then the browser journeys, then the
# multi-instance cluster suite alone. No two suites ever run at once (the linked
# library is reloaded into every worker, so concurrency multiplies memory), and
# the compose stack is always torn down at the end even if a suite fails.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

# Always leave the machine clean, whatever the exit path.
cleanup() {
  docker compose --profile cluster down >/dev/null 2>&1 || true
  docker compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "==> Ensuring Redis is up"
docker compose up -d redis

echo "==> [1/3] api e2e (HTTP, SSE, WebSocket)"
pnpm --filter @nest-realtime-example/api run test:e2e

echo "==> [2/3] Playwright journeys (api + web)"
pnpm --filter @nest-realtime-example/web run test:e2e

echo "==> [3/3] Cluster e2e (compose cluster profile, run alone)"
pnpm run test:e2e:cluster

echo "==> All end-to-end suites passed"
