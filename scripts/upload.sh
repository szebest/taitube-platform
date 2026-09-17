#!/usr/bin/env bash
set -euo pipefail

# scripts/upload.sh — upload a test fixture or video directly to storage via presigned PUT (Ticket 05, PRD US-1)
# Usage: ./scripts/upload.sh [fixture_name|file_path]
# Example: ./scripts/upload.sh s60

FIXTURE_ARG="${1:-s60}"
API_URL="${API_URL:-http://127.0.0.1:3000}"
MINIO_TARGET_IP="${MINIO_TARGET_IP:-127.0.0.1}"

# Fallback to direct bridge container IP if loopback is unreachable and default API_URL is used
if [ "$API_URL" = "http://127.0.0.1:3000" ] && ! curl -s -f -o /dev/null "$API_URL/healthz" 2>/dev/null; then
  CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' vp-api 2>/dev/null || true)
  if [ -n "$CONTAINER_IP" ] && [ "$(curl -s -o /dev/null -w "%{http_code}" "http://${CONTAINER_IP}:3000/healthz" 2>/dev/null || true)" = "200" ]; then
    API_URL="http://${CONTAINER_IP}:3000"
    MINIO_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' vp-minio 2>/dev/null || true)
    if [ -n "$MINIO_IP" ]; then
      MINIO_TARGET_IP="$MINIO_IP"
    fi
  fi
fi

RESOLVE_ARGS=(--resolve "minio:9000:$MINIO_TARGET_IP" --resolve "localhost:9000:$MINIO_TARGET_IP" --resolve "127.0.0.1:9000:$MINIO_TARGET_IP")

echo "==> video-pipeline upload script"

# 1. Resolve file path
if [ -f "$FIXTURE_ARG" ]; then
  FILEPATH="$FIXTURE_ARG"
else
  # Check if fixture exists or generate it
  FIXTURE_FILE="fixtures/${FIXTURE_ARG}_trailer.mp4"
  if [ ! -f "$FIXTURE_FILE" ]; then
    echo "==> Generating fixture $FIXTURE_ARG..."
    pnpm --filter @vp/gen-video gen "$FIXTURE_ARG"
  fi
  FILEPATH="$FIXTURE_FILE"
fi

if [ ! -f "$FILEPATH" ]; then
  echo "Error: File $FILEPATH not found!"
  exit 1
fi

FILENAME=$(basename "$FILEPATH")
# Detect file size (cross-platform Linux/macOS/Git Bash)
if stat -c %s "$FILEPATH" >/dev/null 2>&1; then
  FILESIZE=$(stat -c %s "$FILEPATH")
else
  FILESIZE=$(stat -f %z "$FILEPATH")
fi

echo "==> Target file: $FILEPATH ($FILESIZE bytes)"

# 2. Mint dev JWT
echo "==> Minting dev JWT..."
DEV_USER_ID="00000000-0000-7000-8000-000000000001"
TOKEN=$(pnpm --silent dev-token mint --sub "$DEV_USER_ID" --role pro --ttl 1h --raw)

# 3. Request upload URL (POST /v1/uploads)
echo "==> Requesting upload URL from API ($API_URL/v1/uploads)..."
INIT_RES=$(curl -sS -f "${RESOLVE_ARGS[@]}" -X POST "$API_URL/v1/uploads" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"filename\":\"$FILENAME\",\"sizeBytes\":$FILESIZE,\"contentType\":\"video/mp4\"}")

VIDEO_ID=$(echo "$INIT_RES" | grep -o '"videoId":"[^"]*' | cut -d'"' -f4)
UPLOAD_ID=$(echo "$INIT_RES" | grep -o '"uploadId":"[^"]*' | cut -d'"' -f4)
SINGLE_URL=$(echo "$INIT_RES" | grep -o '"singleUrl":"[^"]*' | cut -d'"' -f4)

if [ -z "$UPLOAD_ID" ] || [ -z "$SINGLE_URL" ]; then
  echo "Error: Failed to obtain upload URL. Response: $INIT_RES" >&2
  exit 1
fi

echo "==> Video ID:  $VIDEO_ID"
echo "==> Upload ID: $UPLOAD_ID"

# 4. Upload bytes directly to storage (MinIO / S3)
echo "==> Uploading $FILESIZE bytes directly to storage..."
curl -sS -f "${RESOLVE_ARGS[@]}" -X PUT "$SINGLE_URL" \
  -H "Content-Type: video/mp4" \
  -H "Content-Length: $FILESIZE" \
  --data-binary "@$FILEPATH"

echo "==> Direct upload completed."

# 5. Complete upload (POST /v1/uploads/:uploadId/complete)
echo "==> Completing upload ($API_URL/v1/uploads/$UPLOAD_ID/complete)..."
COMPLETE_RES=$(curl -sS -f "${RESOLVE_ARGS[@]}" -X POST "$API_URL/v1/uploads/$UPLOAD_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")

STATUS=$(echo "$COMPLETE_RES" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)

echo "==> Success! Video $VIDEO_ID status: $STATUS"
echo "==> Check detail: curl -H \"Authorization: Bearer $TOKEN\" $API_URL/v1/videos/$VIDEO_ID"
