#!/usr/bin/env bash
# Starts the demo: infra in docker, api + 9 worker stages + dev-token serve + production builds of web and studio on the host.
set -euo pipefail
cd "$(dirname "$0")/.."
RUN=demo/.run
mkdir -p "$RUN" /tmp/vp-demo
colima status >/dev/null 2>&1 || colima start
C=(docker compose -f infra/compose/docker-compose.yml -f demo/compose.override.yml)
"${C[@]}" up -d --wait postgres redis minio
"${C[@]}" run --rm minio-init >/dev/null
pnpm turbo run build --filter='./packages/server/*' --filter='./packages/universal/*' --filter=@vp/api --filter=@vp/worker >/dev/null
pnpm db:migrate >/dev/null
start() { # name, command...
  local name=$1; shift
  if [ -f "$RUN/$name.pid" ] && kill -0 "$(cat "$RUN/$name.pid")" 2>/dev/null; then echo "$name already running"; return; fi
  nohup "$@" >"$RUN/$name.log" 2>&1 &
  echo $! >"$RUN/$name.pid"; echo "started $name"
}
build() { # app: a build made without the personas has no marker, so it is built again
  local dist=apps/client/$1/dist
  if [ ! -f "$dist/server/server.js" ] || [ ! -f "$dist/.demo-personas" ]; then
    VITE_DEMO_PERSONAS=true pnpm --filter "@vp/$1" build >"$RUN/$1-build.log" 2>&1
    touch "$dist/.demo-personas"
  fi
}
start api pnpm --filter @vp/api dev
start dev-token pnpm dev-token serve
port=9470
for stage in probe transcode-1080p transcode-720p transcode-480p thumbnail package notify housekeeping captions; do
  port=$((port+1))
  start "worker-$stage" env WORKER_STAGE=$stage METRICS_PORT=$port TMP_DIR=/tmp/vp-demo WORKER_HEARTBEAT_PATH=/tmp/vp-demo/hb-$stage \
    pnpm --filter @vp/worker exec tsx --env-file-if-exists="$PWD/.env" src/main.ts
done
build web
build studio
for app in web:5173 studio:5174; do
  start "${app%%:*}" env SSR_API_BASE_URL=http://localhost:3000 SSR_DEV_TOKEN_URL=http://localhost:3002 \
    pnpm --filter "@vp/${app%%:*}" exec srvx serve --prod --port "${app##*:}" --static ../client --entry dist/server/server.js
done
echo "web http://localhost:5173  studio http://localhost:5174  api http://localhost:3000"
echo "sign in on /login as: viewer, creator, creator2, moderator, admin or guest (one session for both apps)"
echo "fallback: demo/login.sh <viewer|creator|creator2|moderator|admin> prints a snippet for the DevTools console"
