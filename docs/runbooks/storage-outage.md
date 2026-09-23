# Runbook: Object Storage Outage (S3 / MinIO / Cloudflare R2)

## 1. Overview & Architecture
`video-pipeline` decouples compute from media storage by storing all raw incoming video files in private bucket `raw` and multi-rendition HLS ladders, playlists, posters, and thumbnails in bucket `public` (SDD §7, PRD §11, ADR-06).

During an object storage outage (e.g. MinIO container failure, Cloudflare R2 degraded availability, network partitions, credentials expiration):
- Single-PUT and multipart upload completions fail with `STORAGE_UNAVAILABLE`.
- Probe workers fail reading video headers (`GetObject`).
- Transcode workers fail uploading segments or playlists.
- Package workers fail writing `master.m3u8`.

Because storage operations classify network drops, 5xx responses, and timeouts as `TransientError`, BullMQ automatically retries with exponential backoff and jitter (up to 4–8 attempts depending on stage policy). If the storage outage lasts longer than the backoff window, jobs fail safely into the Dead-Letter Queue (`dlq_entries` table in Postgres + `dlq` queue in Redis), where they can be bulk-replayed without data loss or corruption once storage recovers.

---

## 2. Trigger
- **Alert / Symptom**:
  - `JobFailureRateHigh` or `SystemicFailure` firing with `error_code="STORAGE_UNAVAILABLE"`.
  - Storage error spikes in metric `storage_ops_total{result="error"}`.
  - S3 p95 latency alert `histogram_quantile(0.95, storage_op_duration_seconds) > 2.0`.
  - Cloudflare status page reports R2 incidents, or MinIO container health check fails.

---

## 3. Dashboards to Open
- **Storage & Cost Dashboard**: `/d/storage-cost` — Check "Class A & Class B Storage Ops per Hour", "Storage Growth & Operation Latency", and "Storage Operation Duration (p95)".
- **Workers Dashboard**: `/d/workers` — Check failure rates and error code breakdown (`STORAGE_UNAVAILABLE`).
- **Pipeline Overview**: `/d/pipeline` — Check throughput and overall pipeline health.

---

## 4. Diagnosis Steps

### Step 1: Confirm Storage Unavailability Scope
Test connectivity directly from the host or within a pod:

**For Local MinIO**:
```bash
# Check MinIO container status
docker compose ps minio minio-init

# Check MinIO health endpoint
curl -I http://localhost:9000/minio/health/live

# Test S3 API using AWS CLI
aws --endpoint-url http://localhost:9000 s3 ls
```

**For Cloudflare R2 (Cloud Reference Deployment)**:
```bash
# Verify credentials and bucket listing
aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$S3_BUCKET_RAW"

# Check Cloudflare system status
curl -s https://www.cloudflarestatus.com/api/v2/status.json | jq .status
```

### Step 2: Identify Impacted Pipeline Stages
Query Prometheus to see which operations and stages are failing:
```promql
sum by (op, bucket, result) (rate(storage_ops_total[5m]))
```
And check failing queues:
```promql
sum by (queue, error_code) (rate(dlq_entries_total[10m]))
```

---

## 5. Remediation Commands

### Step 1: Pause Ingestion Queues Immediately (Circuit Breaker)
Follow `docs/runbooks/queue-paused.md` to pause the worker queues and prevent exhausting retry attempts:
```bash
# Via Admin API or Bull Board UI
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/probe/pause"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/transcode-1080p/pause"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/transcode-720p/pause"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/transcode-480p/pause"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/thumbnail/pause"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/package/pause"
```

### Step 2: Restore Object Storage Service

**Local MinIO Recovery**:
```bash
# Restart MinIO container
docker compose restart minio minio-init

# Inspect logs if failing to start
docker compose logs minio
```

**Cloud R2 Credential Renewal / Recovery**:
If R2 tokens expired or were rotated:
1. Update `video-pipeline/S3_ACCESS_KEY_ID` and `video-pipeline/S3_SECRET_ACCESS_KEY` in the secret store
   behind `vp-secret-store`.
2. Let the `ExternalSecret` refresh the Secret, then restart the workers:
   ```bash
   kubectl annotate externalsecret vp-secrets -n video-pipeline force-sync=$(date +%s) --overwrite
   kubectl rollout restart deployment -l app.kubernetes.io/component=worker
   ```

**Provider Fallback Ladder (SDD §12.3)**:
If R2 has an extended regional outage, switch to Backblaze B2 (or backup storage) by updating S3 endpoint environment variables in the cloud overlay:
- `S3_ENDPOINT`: `https://s3.<region>.backblazeb2.com`
- `S3_ACCESS_KEY_ID`: `<B2_KEY_ID>`
- `S3_SECRET_ACCESS_KEY`: `<B2_APPLICATION_KEY>`
- `S3_REGION`: `<region>`

### Step 3: Resume Worker Queues
Once storage read/write calls succeed:
```bash
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/probe/resume"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/transcode-1080p/resume"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/transcode-720p/resume"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/transcode-480p/resume"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/thumbnail/resume"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/package/resume"
```

### Step 4: Replay Parked DLQ Jobs
Replay all jobs parked with `STORAGE_UNAVAILABLE` during the outage:
```bash
# Follow dlq-replay runbook to trigger replay for parked entries
curl -X POST \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resetAttempts": true}' \
  "http://localhost:3000/admin/dlq/replay-all"
```

---

## 6. Verification
1. Test object write and read:
   ```bash
   aws --endpoint-url "$S3_ENDPOINT" s3 cp /etc/hosts "s3://$S3_BUCKET_RAW/healthcheck.txt"
   aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://$S3_BUCKET_RAW/healthcheck.txt"
   ```
2. Verify `storage_ops_total{result="error"}` returns to 0.
3. Verify replayed jobs process through to `READY` status.
4. Verify `SystemicFailure` and `JobFailureRateHigh` alerts resolve.

---

## 7. Prevention
1. **Exponential Backoff**: Stage policies specify exponential backoff with full jitter (e.g. 5s -> 10s -> 20s -> 40s) so transient storage blips resolve without operator intervention.
2. **Deterministic Object Keys**: Segment and playlist keys are deterministic (`videos/{id}/hls/{generation}/{rendition}/seg_{n}.ts`). A restarted transcode safely overwrites identical keys without producing orphan fragments.
3. **Multi-Cloud Storage Port**: The storage layer is written against the generic `@aws-sdk/client-s3` API port (`packages/server/storage`), allowing instant fallback from R2 to B2 or MinIO via configuration only.
