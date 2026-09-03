#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Determine execution mode: compose (default if compose containers running) or direct (e.g. service containers in CI)
if [[ "${TEST_MODE:-auto}" == "direct" ]] || { [[ "${TEST_MODE:-auto}" == "auto" ]] && ! docker compose -f "${COMPOSE_FILE}" ps -q postgres 2>/dev/null | grep -q .; }; then
  MODE="direct"
else
  MODE="compose"
fi

PG_HOST="${POSTGRES_HOST:-localhost}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_USER="${POSTGRES_USER:-vp}"
PG_DB="${POSTGRES_DB:-vp}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASSWORD:-vp}"
MINIO_HOST="${MINIO_HOST:-localhost}"
MINIO_PORT="${MINIO_PORT:-9000}"

echo "==> Running infrastructure smoke test (mode: ${MODE})..."

if [[ "${MODE}" == "compose" ]]; then
  echo "==> 1. Checking docker compose services are healthy..."
  docker compose -f "${COMPOSE_FILE}" ps

  echo "==> 2. Checking PostgreSQL connectivity..."
  docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U "${PG_USER}" -d "${PG_DB}"

  echo "==> 3. Checking Redis configuration (BullMQ requirements: noeviction + appendonly)..."
  REDIS_MAXMEMORY_POLICY=$(docker compose -f "${COMPOSE_FILE}" exec -T redis redis-cli -a "${REDIS_PASS}" config get maxmemory-policy | tr -d '\r' | tail -n 1)
  REDIS_APPENDONLY=$(docker compose -f "${COMPOSE_FILE}" exec -T redis redis-cli -a "${REDIS_PASS}" config get appendonly | tr -d '\r' | tail -n 1)

  echo "==> 4. Checking MinIO buckets (raw and public)..."
  docker compose -f "${COMPOSE_FILE}" run --rm minio-init mc alias set local http://minio:9000 minioadmin minioadmin
  BUCKETS=$(docker compose -f "${COMPOSE_FILE}" run --rm minio-init mc ls local | tr -d '\r')

  echo "==> 5. Checking ILM rules on 'raw' bucket..."
  ILM_RULES=$(docker compose -f "${COMPOSE_FILE}" run --rm minio-init mc ilm ls local/raw | tr -d '\r')

  echo "==> 6. Checking anonymous read policy on 'public' (expect 404 for missing object, not 403)..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${MINIO_HOST}:${MINIO_PORT}/public/missing-test-file.txt" || true)
else
  echo "==> 1. Checking PostgreSQL connectivity..."
  pg_isready -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB}"

  echo "==> 2. Checking Redis configuration (BullMQ requirements: noeviction + appendonly)..."
  REDIS_MAXMEMORY_POLICY=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASS}" config get maxmemory-policy | tr -d '\r' | tail -n 1)
  REDIS_APPENDONLY=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASS}" config get appendonly | tr -d '\r' | tail -n 1)

  echo "==> 3. Checking MinIO buckets (raw and public)..."
  mc alias set local "http://${MINIO_HOST}:${MINIO_PORT}" minioadmin minioadmin
  BUCKETS=$(mc ls local | tr -d '\r')

  echo "==> 4. Checking ILM rules on 'raw' bucket..."
  ILM_RULES=$(mc ilm ls local/raw | tr -d '\r')

  echo "==> 5. Checking anonymous read policy on 'public' (expect 404 for missing object, not 403)..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${MINIO_HOST}:${MINIO_PORT}/public/missing-test-file.txt" || true)
fi

if [[ "${REDIS_MAXMEMORY_POLICY}" != "noeviction" ]]; then
  echo "FAIL: Expected redis maxmemory-policy to be 'noeviction', got '${REDIS_MAXMEMORY_POLICY}'"
  exit 1
fi

if [[ "${REDIS_APPENDONLY}" != "yes" ]]; then
  echo "FAIL: Expected redis appendonly to be 'yes', got '${REDIS_APPENDONLY}'"
  exit 1
fi
echo "OK: Redis maxmemory-policy=noeviction, appendonly=yes"

echo "${BUCKETS}" | grep -q "raw" || { echo "FAIL: 'raw' bucket missing"; exit 1; }
echo "${BUCKETS}" | grep -q "public" || { echo "FAIL: 'public' bucket missing"; exit 1; }
echo "OK: Buckets 'raw' and 'public' present."

echo "${ILM_RULES}"
echo "${ILM_RULES}" | grep -q "7 day" || { echo "FAIL: ILM rule does not contain 7 days expiration"; exit 1; }
echo "OK: ILM lifecycle rules verified."

if [[ "${HTTP_CODE}" != "404" ]]; then
  echo "FAIL: Expected anonymous GET /public/missing to return 404, got ${HTTP_CODE}"
  exit 1
fi
echo "OK: Anonymous GET /public/missing returned 404."

echo "==> ALL INFRASTRUCTURE SMOKE TESTS PASSED!"
