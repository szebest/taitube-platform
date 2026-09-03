#!/bin/sh
set -e

echo "[minio-init] Waiting for MinIO to be ready..."
until mc alias set local http://minio:9000 minioadmin minioadmin; do
  echo "[minio-init] MinIO not ready yet, retrying in 2s..."
  sleep 2
done

echo "[minio-init] Creating buckets..."
mc mb --ignore-existing local/raw
mc mb --ignore-existing local/public

echo "[minio-init] Setting anonymous download policy on public bucket..."
mc anonymous set download local/public

echo "[minio-init] Configuring lifecycle rules on raw bucket..."
# Clear any existing ILM rules to ensure idempotency
mc ilm rule rm --all --force local/raw 2>/dev/null || true

# Add rule: expire objects after 7 days, abort incomplete multiparts after 1 day
mc ilm rule add --expire-days 7 --abort-incomplete-multipart-days 1 local/raw

echo "[minio-init] Initialization complete:"
mc ls local/
echo "[minio-init] ILM rules for raw:"
mc ilm ls local/raw

exit 0
