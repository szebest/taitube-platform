#!/usr/bin/env bash
# Readiness under a lost dependency: the API's /readyz while MinIO is stopped, and a worker's
# /readyz while toxiproxy cuts its Redis connection. Each must answer 503 and recover to 200.
set -euo pipefail

COMPOSE="docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.chaos.yml --profile chaos"
TOXIPROXY=http://127.0.0.1:8474
DEADLINE_SEC="${DEADLINE_SEC:-30}"

api_ready() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/readyz || true; }
worker_ready() {
  $COMPOSE exec -T worker-notify curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:9464/readyz || true
}

expect_status() {
  local label=$1 probe=$2 want=$3 started got
  started=$(date +%s)
  while :; do
    got=$($probe)
    if [ "$got" = "$want" ]; then
      echo "PASS  $label: $want after $(($(date +%s) - started))s"
      return 0
    fi
    if [ $(($(date +%s) - started)) -ge "$DEADLINE_SEC" ]; then
      echo "FAIL  $label: wanted $want, still $got after ${DEADLINE_SEC}s"
      return 1
    fi
    sleep 1
  done
}

set_redis_proxy() {
  curl -fsS -X POST "$TOXIPROXY/proxies/redis" -d "{\"enabled\": $1}" >/dev/null
}

[ -f .env ] || cp .env.example .env
$COMPOSE up -d --no-build --wait --wait-timeout 180 \
  postgres redis minio minio-init migrate api toxiproxy worker-notify
trap 'set_redis_proxy true || true; $COMPOSE start minio >/dev/null 2>&1 || true' EXIT

expect_status "api /readyz, every dependency up" api_ready 200
expect_status "worker-notify /readyz, every dependency up" worker_ready 200

$COMPOSE stop minio >/dev/null
expect_status "api /readyz, MinIO stopped" api_ready 503
$COMPOSE start minio >/dev/null
expect_status "api /readyz, MinIO back" api_ready 200

set_redis_proxy false
expect_status "worker-notify /readyz, Redis cut by toxiproxy" worker_ready 503
set_redis_proxy true
expect_status "worker-notify /readyz, Redis restored" worker_ready 200
