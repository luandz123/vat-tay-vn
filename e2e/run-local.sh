#!/bin/bash
# Build + chạy app ở chế độ test rồi chạy e2e/smoke.mjs. Cần Postgres test tại E2E_DATABASE_URL.
set -e
cd "$(dirname "$0")/.."
DB=${E2E_DATABASE_URL:?Đặt E2E_DATABASE_URL trỏ vào Postgres test riêng}
PORT=${E2E_PORT:-3123}
LOG=${E2E_LOG:-/tmp/vattay-e2e.log}
export E2E_ALLOW_FAKE_AUTH=1 DATABASE_URL="$DB" NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=x \
  SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SITE_URL=http://localhost:$PORT
if curl -s -o /dev/null "http://localhost:$PORT"; then echo "Cổng $PORT đang có server khác chạy — tắt nó trước (pkill -f next-server)"; exit 1; fi
[ "${SKIP_BUILD:-}" = 1 ] || npm run build > "$LOG.build" 2>&1
setsid npx next start -p "$PORT" > "$LOG" 2>&1 &
APP=$!
trap 'kill -- -$APP 2>/dev/null; pkill -f next-server 2>/dev/null' EXIT  # next start sinh tiến trình next-server riêng
for _ in $(seq 30); do curl -s -o /dev/null "http://localhost:$PORT" && break; sleep 1; done
BASE_URL=http://localhost:$PORT node e2e/smoke.mjs
