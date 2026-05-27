#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# ── Kill stale dev servers on both ports ──
echo "[clean] stopping stale processes..."
for port in 4000 5173; do
  pids=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $5}' || true)
  for pid in $pids; do
    taskkill //PID "$pid" //F 2>/dev/null && echo "         killed PID $pid (port $port)" || true
  done
done

# ── Launch both ──
echo "[start] API :4000  Web :5173"
echo "         (tsx watch — auto-reload on save)"
echo ""

exec npx concurrently -n api,web -c cyan,green \
  "npx tsx watch apps/api/src/server.ts" \
  "cd apps/web && npx vite --host 0.0.0.0"
