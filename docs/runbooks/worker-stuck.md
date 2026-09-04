# Runbook: Worker Stuck, Processing Orphan Triage, and Reconciler Operations

## 1. Overview & Architecture

In `video-pipeline`, the source of truth is **Postgres**, while **Redis** serves as a cache of intent (SDD Principle P2). Under normal operation, jobs move seamlessly through the stages (`probe` -> `transcode` rungs + `thumbnail` -> `package` -> `notify`).

However, failures can occur in distributed environments:
- **Worker crash or ungraceful shutdown**: A pod running FFmpeg or package steps dies without releasing locks.
- **Lost Redis state / dual-write gap**: Postgres commits state, but Redis fails or restarts before the enqueue succeeds.
- **Client abandonment**: A client initiates a multipart upload, uploads some parts, but never calls `complete` or `abort`.
- **Orphaned processing**: A video remains in `PROCESSING` indefinitely because the job was lost or dropped from Redis.

### Reconciler Safety Net (SDD §9.8, §5.3, ADR-09, ADR-16)
The `housekeeping` worker executes five automated job schedulers:
1. **`reconcile-uploads` (`*/15 * * * *`)**:
   - Aborts uploads stuck in `UPLOADING` for > 24 hours (-> `ABANDONED`) and calls storage `AbortMultipartUpload`.
   - Re-enqueues videos left `UPLOADED` with no `probe` step for > 5 minutes with deterministic idempotent job IDs (`${videoId}--probe--g${generation}`).
2. **`reconcile-processing` (`*/10 * * * *`)**:
   - Identifies videos in `PROCESSING` for > 3 hours that have no `RUNNING` step in `processing_steps` and no queued/active jobs in BullMQ.
   - Marks the video `FAILED` with `errorCode = 'ORPHANED'`.
   - Records an entry in `dlq_entries` (`status = 'PARKED'`, `queue = 'housekeeping'`).
3. **`purge-deleted` (`0 * * * *`)**:
   - Deletes storage objects for soft-deleted videos (`DELETED` > 1 hour) across raw and public prefixes.
   - Hard-deletes the video row in Postgres (cascading to uploads, renditions, steps, events).
   - Purges old generation prefixes (e.g. `videos/${videoId}/hls/g1/`) for reprocessed videos whose new generation is `READY`.
4. **`expire-raw` (`30 3 * * *`)**:
   - Deletes `raw/` sources for `READY` videos older than `RAW_RETENTION_DAYS` (default 7 days).
   - Appends `video.raw_expired` audit event in `video_events`.
5. **`tmp-sweep` (`*/30 * * * *`)**:
   - Cleans orphaned temporary directories under `/tmp/vp/*` older than 2 hours.

---

## 2. Alerting & Symptoms

### Key Alerts
- **`VideoProcessingStuck`**: Fires when videos remain in `PROCESSING` or `PROBING` for > 3 hours.
- **`ReconcilerRepairsHigh`**: Fires when `reconciler_repairs_total` spikes, indicating Redis job dropouts or API dual-write failures.
- **`StaleUploadsHigh`**: Fires when more than 50 uploads remain in `UPLOADING` without progress for > 24 hours.
- **`DLQEntryCreated`**: Fires when `dlq_entries_total{error_code="ORPHANED"}` increments.

---

## 3. Triage & Investigation Steps

### Step 1: Query Stuck Videos in Postgres
Inspect any videos stuck in `PROCESSING` or `PROBING`:
```sql
SELECT id, status, generation, updated_at, NOW() - updated_at AS duration
FROM videos
WHERE status IN ('PROBING', 'PROCESSING')
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at ASC;
```

### Step 2: Check Processing Steps and Worker Heartbeats
Inspect step progress for the identified video:
```sql
SELECT step, rendition, status, attempt, worker_id, started_at, heartbeat_at, error_code, error_message
FROM processing_steps
WHERE video_id = '<VIDEO_ID>'
ORDER BY started_at ASC;
```
- If a step is `RUNNING` but `heartbeat_at` is older than 5 minutes, the worker pod likely died or was OOM-killed.
- If no step is `RUNNING` and no jobs are active, the video is orphaned.

### Step 3: Inspect BullMQ Queue Status via Admin API / Bull Board
Check whether jobs exist in Redis:
```bash
curl -s -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues"
```
Or view the Bull Board dashboard at `http://localhost:3000/admin/queues`.
Look at `waiting`, `active`, and `failed` counts for `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, and `package`.

---

## 4. Remediation Actions

### Option A: Let the Automated Reconciler Handle the Video
- **For `UPLOADED` videos with missing probe jobs**: Wait for `reconcile-uploads` (`*/15 * * * *`). It will detect the video and re-enqueue with deterministic ID `${videoId}--probe--g${generation}`.
- **For orphaned `PROCESSING` videos**: Wait for `reconcile-processing` (`*/10 * * * *`). It will transition the video to `FAILED('ORPHANED')` and create a DLQ entry.

### Option B: Reprocess the Stuck or Orphaned Video
If a video is stuck or failed as `ORPHANED`, trigger a clean reprocess (bumps generation, avoids stale job collisions):
```bash
curl -X POST \
  -H "Authorization: Bearer $USER_OR_ADMIN_JWT" \
  "http://localhost:3000/v1/videos/<VIDEO_ID>/reprocess"
```
**Outcome:**
1. Video transitions to `PROBING` with `generation = generation + 1` (e.g. `g2`).
2. New deterministic probe job enqueued (`${videoId}--probe--g2`).
3. Transcoding outputs to `videos/<VIDEO_ID>/hls/g2/`.
4. Previous generation files will be cleaned up by `purge-deleted` once `g2` is `READY`.

### Option C: Manual Cleanup of Stale Incomplete Multiparts
If S3 storage accumulates orphaned multipart uploads:
```bash
# List in-flight multiparts
aws --endpoint-url http://localhost:9000 s3api list-multipart-uploads --bucket raw

# Abort a specific stuck upload
aws --endpoint-url http://localhost:9000 s3api abort-multipart-upload \
  --bucket raw \
  --key <SOURCE_KEY> \
  --upload-id <UPLOAD_ID>
```
`reconcile-uploads` executes this automatically for any upload older than 24 hours.

---

## 5. Prevention & Guardrails

1. **Autosuspend Compatibility (Neon Guardrail)**: Reconciler schedules run every 10–15 minutes, allowing Neon compute to idle down (5 min autosuspend). Do not reduce cron frequency below 10 minutes in cloud production.
2. **Deterministic Job IDs**: All probe and stage jobs use `${videoId}--${step}--g${generation}`. Duplicate enqueues are idempotent no-ops.
3. **CAS State Transitions**: All status changes use compare-and-set queries (`WHERE id = $1 AND status = '...'`), preventing race conditions between concurrent housekeeping workers.
