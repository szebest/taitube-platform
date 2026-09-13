#!/usr/bin/env bash
set -euo pipefail

# scripts/e2e-smoke-offline.sh — Offline smoke test for video-pipeline (Ticket 35, PRD G11)
#
# Verifies the stack operates correctly inside an internal Docker network
# with zero internet egress. Runs ALL tests via `docker compose exec` since
# `internal: true` networks don't allow host-to-container port publishing.
#
# Usage: bash scripts/e2e-smoke-offline.sh
#        (stack must already be running with the offline overlay)

COMPOSE_FILES="-f infra/compose/docker-compose.yml -f infra/compose/docker-compose.offline.yml"
TIMEOUT_SEC="${TIMEOUT_SEC:-300}"

echo "================================================="
echo "==> Running OFFLINE E2E Smoke Test (container-side)"
echo "================================================="

# 1. Check API liveness from inside the api container
echo "==> Checking API health (container-side)..."
docker compose $COMPOSE_FILES exec -T api curl -s -f http://localhost:3000/healthz > /dev/null
echo "API is healthy."

# 2. Verify internet is blocked — a DNS/HTTP request to the public internet must fail
echo "==> Verifying internet egress is blocked..."
if docker compose $COMPOSE_FILES exec -T api sh -c "curl -s --connect-timeout 3 http://ifconfig.me 2>/dev/null" > /dev/null 2>&1; then
  echo "ERROR: Container can reach the public internet! Offline mode is broken."
  exit 1
fi
echo "Internet egress correctly blocked."

# 3. Verify inter-container communication (API can reach Postgres, Redis, MinIO)
echo "==> Verifying inter-container communication..."
docker compose $COMPOSE_FILES exec -T api sh -c "curl -s -f http://minio:9000/minio/health/live > /dev/null"
echo "  MinIO reachable from API container."

# 4. Generate fixture inside a container (if not already present)
# The test fixture is generated on the host by CI and bind-mounted into the container.
# We use the API container which has the full Node.js environment.
FIXTURE_DIR="tests/fixtures"
FIXTURE_FILE="s15.mp4"
if [ ! -f "$FIXTURE_DIR/$FIXTURE_FILE" ]; then
  echo "==> Generating test fixture on host..."
  pnpm gen-video --only s15
fi

# 5. Mint auth token from host (this is a local-only dev tool, runs against host-side Node)
echo "==> Minting dev JWT on host..."
DEV_USER_ID="00000000-0000-7000-8000-000000000001"
TOKEN=$(pnpm --silent dev-token mint --sub "$DEV_USER_ID" --role admin --ttl 1h --raw)

# 6. Upload fixture via the API container using curl
echo "==> Uploading test fixture via API..."
# Copy fixture into the api container
docker compose $COMPOSE_FILES cp "$FIXTURE_DIR/$FIXTURE_FILE" api:/tmp/fixture.mp4

# Request upload URL
INIT_RES=$(docker compose $COMPOSE_FILES exec -T api curl -sS -f \
  -X POST http://localhost:3000/v1/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"filename\":\"$FIXTURE_FILE\",\"sizeBytes\":$(wc -c < "$FIXTURE_DIR/$FIXTURE_FILE" | tr -d ' '),\"contentType\":\"video/mp4\"}")

VIDEO_ID=$(echo "$INIT_RES" | grep -o '"videoId":"[^"]*' | cut -d'"' -f4)
UPLOAD_ID=$(echo "$INIT_RES" | grep -o '"uploadId":"[^"]*' | cut -d'"' -f4)
SINGLE_URL=$(echo "$INIT_RES" | grep -o '"singleUrl":"[^"]*' | cut -d'"' -f4)

if [ -z "$UPLOAD_ID" ] || [ -z "$SINGLE_URL" ]; then
  echo "Error: Failed to obtain upload URL. Response: $INIT_RES"
  exit 1
fi

echo "==> Video ID:  $VIDEO_ID"
echo "==> Upload ID: $UPLOAD_ID"

# Upload the file directly to storage from inside the API container
FILESIZE=$(wc -c < "$FIXTURE_DIR/$FIXTURE_FILE" | tr -d ' ')
docker compose $COMPOSE_FILES exec -T api curl -sS -f \
  -X PUT "$SINGLE_URL" \
  -H "Content-Type: video/mp4" \
  -H "Content-Length: $FILESIZE" \
  --data-binary "@/tmp/fixture.mp4"

echo "==> Direct upload completed."

# Complete upload
docker compose $COMPOSE_FILES exec -T api curl -sS -f \
  -X POST "http://localhost:3000/v1/uploads/$UPLOAD_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}"

echo "==> Upload completed."

# 7. Poll until video is READY
START_TIME=$(date +%s)
echo "==> Polling for READY state (timeout: ${TIMEOUT_SEC}s)..."

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START_TIME))

  if [ "$ELAPSED" -ge "$TIMEOUT_SEC" ]; then
    echo "Error: Timed out after ${TIMEOUT_SEC}s waiting for video $VIDEO_ID to reach READY."
    exit 1
  fi

  VIDEO_RES=$(docker compose $COMPOSE_FILES exec -T api curl -sS -f \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/v1/videos/$VIDEO_ID")
  STATUS=$(echo "$VIDEO_RES" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)

  echo "  [+${ELAPSED}s] Video status: $STATUS"

  if [ "$STATUS" = "READY" ]; then
    echo "==> Video reached READY in ${ELAPSED}s!"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "Error: Video processing failed: $VIDEO_RES"
    exit 1
  fi

  sleep 3
done

# 8. Verify HLS playback URLs
PLAYBACK_URL=$(echo "$VIDEO_RES" | grep -o '"playbackUrl":"[^"]*' | cut -d'"' -f4)
if [ -z "$PLAYBACK_URL" ]; then
  echo "Error: READY video missing playbackUrl in response"
  exit 1
fi

echo "==> Fetching master playlist (container-side): $PLAYBACK_URL"
MASTER_CONTENT=$(docker compose $COMPOSE_FILES exec -T api curl -sS -f "$PLAYBACK_URL")
echo "$MASTER_CONTENT"

if ! echo "$MASTER_CONTENT" | grep -q "#EXTM3U"; then
  echo "Error: Master playlist does not contain #EXTM3U"
  exit 1
fi

if ! echo "$MASTER_CONTENT" | grep -q "#EXT-X-STREAM-INF"; then
  echo "Error: Master playlist does not contain #EXT-X-STREAM-INF stream"
  exit 1
fi

# 9. Fetch child playlist and segment
PLAYLIST_DIR=$(dirname "$PLAYBACK_URL")
RENDITION_LINE=$(echo "$MASTER_CONTENT" | grep -v "^#" | head -n 1 | tr -d '\r')
RENDITION_URL="$PLAYLIST_DIR/$RENDITION_LINE"

echo "==> Fetching rendition playlist: $RENDITION_URL"
RENDITION_CONTENT=$(docker compose $COMPOSE_FILES exec -T api curl -sS -f "$RENDITION_URL")

if ! echo "$RENDITION_CONTENT" | grep -q "#EXT-X-ENDLIST"; then
  echo "Error: Rendition playlist missing #EXT-X-ENDLIST"
  exit 1
fi

SEGMENT_LINE=$(echo "$RENDITION_CONTENT" | grep -v "^#" | head -n 1 | tr -d '\r')
RENDITION_DIR=$(dirname "$RENDITION_URL")
SEGMENT_URL="$RENDITION_DIR/$SEGMENT_LINE"

echo "==> Fetching first TS segment: $SEGMENT_URL"
SEGMENT_SIZE=$(docker compose $COMPOSE_FILES exec -T api curl -sS -f "$SEGMENT_URL" | wc -c)

if [ "$SEGMENT_SIZE" -lt 1000 ]; then
  echo "Error: Segment size unexpectedly small ($SEGMENT_SIZE bytes)"
  exit 1
fi

echo "==> Segment verified ($SEGMENT_SIZE bytes)."
echo "================================================="
echo "==> OFFLINE E2E SMOKE TEST PASSED in ${ELAPSED}s!"
echo "================================================="
exit 0
