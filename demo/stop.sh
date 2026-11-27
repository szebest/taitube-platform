#!/usr/bin/env bash
# Stops what demo/start.sh started (process trees from pid files plus listeners on the demo ports), then the compose infra.
cd "$(dirname "$0")/.."
killtree() { for c in $(pgrep -P "$1"); do killtree "$c"; done; kill "$1" 2>/dev/null; }
for f in demo/.run/*.pid; do [ -f "$f" ] || continue; killtree "$(cat "$f")"; rm -f "$f"; done
for port in 3000 3002 5173 5174 9464 9471 9472 9473 9474 9475 9476 9477 9478 9479; do
  for pid in $(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null); do
    lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | grep -q "$PWD" && kill "$pid"
  done
done
[ "${1:-}" = "--keep-infra" ] || docker compose -f infra/compose/docker-compose.yml -f demo/compose.override.yml --profile '*' stop
