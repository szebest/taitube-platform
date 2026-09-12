#!/usr/bin/env bash
set -euo pipefail

# scripts/e2e-smoke.sh — End-to-end smoke test for video-pipeline (Ticket 08, AC 17)
# Uploads a fixture, polls until READY, and verifies HLS playlist and segment playback.

API_URL="${API_URL:-http://localhost:3000}"
TIMEOUT_SEC="${TIMEOUT_SEC:-300}"
DEV_USER_ID="00000000-0000-7000-8000-000000000001"

echo "================================================="
echo "==> Running E2E Smoke Test against $API_URL"
echo "================================================="

# 1. Check API liveness
echo "==> Checking API health..."
curl -s -f "$API_URL/healthz" > /dev/null || (echo "API is not healthy at $API_URL/healthz" && exit 1)
echo "API is healthy."

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

  VIDEO_RES=$(curl -sS -f --resolve minio:9000:127.0.0.1 -H "Authorization: Bearer $TOKEN" "$API_URL/v1/videos/$VIDEO_ID")
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
MASTER_CONTENT=$(curl -sS -f --resolve minio:9000:127.0.0.1 "$PLAYBACK_URL")
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
RENDITION_CONTENT=$(curl -sS -f --resolve minio:9000:127.0.0.1 "$RENDITION_URL")

if ! echo "$RENDITION_CONTENT" | grep -q "#EXT-X-ENDLIST"; then
  echo "Error: Rendition playlist missing #EXT-X-ENDLIST"
  exit 1
fi

SEGMENT_LINE=$(echo "$RENDITION_CONTENT" | grep -v "^#" | head -n 1)
RENDITION_DIR=$(dirname "$RENDITION_URL")
SEGMENT_URL="$RENDITION_DIR/$SEGMENT_LINE"

echo "==> Fetching first TS segment: $SEGMENT_URL"
SEGMENT_SIZE=$(curl -sS -f --resolve minio:9000:127.0.0.1 "$SEGMENT_URL" | wc -c)

if [ "$SEGMENT_SIZE" -lt 1000 ]; then
  echo "Error: Segment size unexpectedly small ($SEGMENT_SIZE bytes)"
  exit 1
fi

echo "==> Segment verified ($SEGMENT_SIZE bytes)."
echo "================================================="
echo "==> E2E SMOKE TEST PASSED SUCCESSFULLY in ${ELAPSED}s!"
echo "================================================="
exit 0
