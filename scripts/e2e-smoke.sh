#!/usr/bin/env bash
set -euo pipefail

# scripts/e2e-smoke.sh — End-to-end smoke test for video-pipeline (Ticket 08, AC 17)
# Uploads a fixture, polls until READY, and verifies HLS playlist and segment playback.

API_URL="${API_URL:-http://127.0.0.1:3000}"
MINIO_TARGET_IP="${MINIO_TARGET_IP:-127.0.0.1}"
export MINIO_TARGET_IP
TIMEOUT_SEC="${TIMEOUT_SEC:-300}"
DEV_USER_ID="00000000-0000-7000-8000-000000000001"

echo "================================================="
echo "==> Running E2E Smoke Test against $API_URL"
echo "================================================="

# 1. Check API liveness
echo "==> Checking API health at $API_URL/healthz..."
API_HEALTHY=false
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/healthz" 2>/dev/null || true)
  if [ "$HTTP_CODE" = "200" ]; then
    API_HEALTHY=true
    break
  fi
  sleep 1
done

if [ "$API_HEALTHY" != "true" ]; then
  # Check if direct bridge container connectivity works (in case host loopback is blocked on Linux)
  CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' vp-api 2>/dev/null || true)
  if [ -n "$CONTAINER_IP" ]; then
    CONTAINER_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${CONTAINER_IP}:3000/healthz" 2>/dev/null || true)
    if [ "$CONTAINER_CODE" = "200" ]; then
      echo "==> Bridge container IP reached directly! Updating API_URL=http://${CONTAINER_IP}:3000"
      API_URL="http://${CONTAINER_IP}:3000"
      export API_URL
      MINIO_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' vp-minio 2>/dev/null || true)
      if [ -n "$MINIO_IP" ]; then
        MINIO_TARGET_IP="$MINIO_IP"
        export MINIO_TARGET_IP
      fi
      API_HEALTHY=true
    fi
  fi
fi

if [ "$API_HEALTHY" = "true" ]; then
  echo "API is healthy (HTTP 200)."
  RESOLVE_ARGS=(--resolve "minio:9000:$MINIO_TARGET_IP" --resolve "localhost:9000:$MINIO_TARGET_IP" --resolve "127.0.0.1:9000:$MINIO_TARGET_IP")
else
  echo "ERROR: API is not healthy at $API_URL/healthz after 30 attempts."
  echo "==================== FULL SYSTEM & NETWORK DIAGNOSTICS ===================="
  echo "--- 1. Verbose curl to $API_URL/healthz ---"
  curl -v "$API_URL/healthz" || true

  echo "--- 2. Verbose curl to http://127.0.0.1:3000/healthz ---"
  curl -v "http://127.0.0.1:3000/healthz" || true

  if [ -n "${CONTAINER_IP:-}" ]; then
    echo "--- 3. Verbose curl to container IP http://${CONTAINER_IP}:3000/healthz ---"
    curl -v "http://${CONTAINER_IP}:3000/healthz" || true
  fi

  echo "--- 4. In-container health check ---"
  docker compose -f infra/compose/docker-compose.yml exec -T api curl -v http://localhost:3000/healthz || true

  echo "--- 5. Listening ports on host ---"
  ss -tlpn 2>/dev/null || netstat -tlpn 2>/dev/null || true

  echo "--- 6. Routing table ---"
  ip route 2>/dev/null || true

  echo "--- 7. iptables rules ---"
  sudo iptables -L -n -v 2>/dev/null || true
  sudo iptables -t nat -L -n -v 2>/dev/null || true

  echo "--- 8. Container statuses ---"
  docker compose -f infra/compose/docker-compose.yml ps || true
  echo "=========================================================================="
  exit 1
fi

# 2. Resolve fixture
FIXTURE_PATH="tests/fixtures/s15.mp4"
if [ ! -f "$FIXTURE_PATH" ]; then
  if [ -f "fixtures/s15.mp4" ]; then
    FIXTURE_PATH="fixtures/s15.mp4"
  else
    echo "==> Fixture s15.mp4 not found, generating..."
    pnpm gen-video --only s15
  fi
fi

echo "==> Using test fixture: $FIXTURE_PATH"

# 3. Upload fixture via upload.sh
UPLOAD_TMP=$(mktemp)
if ! bash scripts/upload.sh "$FIXTURE_PATH" > "$UPLOAD_TMP" 2>&1; then
  echo "Error: upload.sh failed. Full output:" >&2
  cat "$UPLOAD_TMP" >&2
  rm -f "$UPLOAD_TMP"
  exit 1
fi
cat "$UPLOAD_TMP"
UPLOAD_OUT=$(cat "$UPLOAD_TMP")
rm -f "$UPLOAD_TMP"

VIDEO_ID=$(echo "$UPLOAD_OUT" | grep -o "Video ID:  [a-f0-9-]*" | awk '{print $3}')
if [ -z "$VIDEO_ID" ]; then
  echo "Error: Failed to parse Video ID from upload output"
  exit 1
fi

echo "==> Uploaded video ID: $VIDEO_ID"

# 4. Mint auth token for API inspection
TOKEN=$(pnpm --silent dev-token mint --sub "$DEV_USER_ID" --role admin --ttl 1h --raw)

# 5. Poll until video is READY
START_TIME=$(date +%s)
echo "==> Polling for READY state (timeout: ${TIMEOUT_SEC}s)..."

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START_TIME))

  if [ "$ELAPSED" -ge "$TIMEOUT_SEC" ]; then
    echo "Error: Timed out after ${TIMEOUT_SEC}s waiting for video $VIDEO_ID to reach READY."
    exit 1
  fi

  VIDEO_RES=$(curl -sS -f "${RESOLVE_ARGS[@]}" -H "Authorization: Bearer $TOKEN" "$API_URL/v1/videos/$VIDEO_ID")
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

# 6. Verify HLS playback URLs
PLAYBACK_URL=$(echo "$VIDEO_RES" | grep -o '"playbackUrl":"[^"]*' | cut -d'"' -f4)
if [ -z "$PLAYBACK_URL" ]; then
  echo "Error: READY video missing playbackUrl in response"
  exit 1
fi

echo "==> Fetching master playlist: $PLAYBACK_URL"
MASTER_CONTENT=$(curl -sS -f "${RESOLVE_ARGS[@]}" "$PLAYBACK_URL")
echo "$MASTER_CONTENT"

if ! echo "$MASTER_CONTENT" | grep -q "#EXTM3U"; then
  echo "Error: Master playlist does not contain #EXTM3U"
  exit 1
fi

if ! echo "$MASTER_CONTENT" | grep -q "#EXT-X-STREAM-INF"; then
  echo "Error: Master playlist does not contain #EXT-X-STREAM-INF stream"
  exit 1
fi

# 7. Fetch child playlist and segment
PLAYLIST_DIR=$(dirname "$PLAYBACK_URL")
RENDITION_LINE=$(echo "$MASTER_CONTENT" | grep -v "^#" | head -n 1)
RENDITION_URL="$PLAYLIST_DIR/$RENDITION_LINE"

echo "==> Fetching rendition playlist: $RENDITION_URL"
RENDITION_CONTENT=$(curl -sS -f "${RESOLVE_ARGS[@]}" "$RENDITION_URL")

if ! echo "$RENDITION_CONTENT" | grep -q "#EXT-X-ENDLIST"; then
  echo "Error: Rendition playlist missing #EXT-X-ENDLIST"
  exit 1
fi

SEGMENT_LINE=$(echo "$RENDITION_CONTENT" | grep -v "^#" | head -n 1)
RENDITION_DIR=$(dirname "$RENDITION_URL")
SEGMENT_URL="$RENDITION_DIR/$SEGMENT_LINE"

echo "==> Fetching first TS segment: $SEGMENT_URL"
SEGMENT_SIZE=$(curl -sS -f "${RESOLVE_ARGS[@]}" "$SEGMENT_URL" | wc -c)

if [ "$SEGMENT_SIZE" -lt 1000 ]; then
  echo "Error: Segment size unexpectedly small ($SEGMENT_SIZE bytes)"
  exit 1
fi

echo "==> Segment verified ($SEGMENT_SIZE bytes)."
echo "================================================="
echo "==> E2E SMOKE TEST PASSED SUCCESSFULLY in ${ELAPSED}s!"
echo "================================================="
exit 0
