# Runbook: Dead-Letter Queue (DLQ) Triage, Replay, and Systemic Failure Circuit

## 1. Overview & Architecture

BullMQ lacks a native Dead-Letter Queue mechanism. `video-pipeline` implements the dual-mirror DLQ pattern:
- **Redis Queue (`dlq`)**: Holds a copy of the failed job for Bull Board visibility and operator inspection. No workers consume this queue. Failed jobs are retained with 7-day TTL (`removeOnFail.age`).
- **Postgres Mirror (`dlq_entries`)**: Authoritative source of truth (SDD principle P2). Persists every job that exhausted attempts or threw a `PermanentError` with its payload, error classification, worker ID, attempts made, and lifecycle status (`PARKED`, `REPLAYED`, `DISCARDED`).
- **Audit Log (`video_events`)**: State changes (`dlq.replayed`, `dlq.discarded`, `video.failed`, `video.reprocessing`) are appended to `video_events` for tracing.

---

## 2. Trigger
- **Alert / Symptom**:
  - `DLQNotEmpty`: Alerts when `dlq_entries_total{queue, error_code}` increases or unhandled items land in `PARKED`.
  - `SystemicFailure`: Fires when `jobs_failed_total` for a queue exceeds 50% over a 5-minute rolling window.
  - Operator observation of failed videos in `FAILED` status with permanent error codes.

---

## 3. Dashboards to Open
- **Workers Dashboard**: `/d/workers` — Check "DLQ Entries Total by Queue & Error Code" and error distributions.
- **Pipeline Overview**: `/d/pipeline` — Check throughput and pipeline failure rates.
- **Queues Dashboard**: `/d/queues` — Check queue depths and dead-letter queue count.
- **Bull Board UI**: `http://localhost:3000/admin/queues` — Inspect active, failed, and `dlq` queues.

---

## 4. Diagnosis Steps

### Step 1: Inspect DLQ Entries
Use the admin API to paginate and filter parked entries:
```bash
curl -s -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/admin/dlq?status=PARKED&limit=20" | jq .
```
Response format:
```json
{
  "items": [
    {
      "id": "018f...-uuid",
      "queue": "transcode-720p",
      "jobId": "018f...--transcode--720p--g1",
      "videoId": "018f...-uuid",
      "errorCode": "STORAGE_UNAVAILABLE",
      "errorMessage": "S3 connection timeout after 3 attempts",
      "attemptsMade": 4,
      "status": "PARKED",
      "createdAt": "2026-09-04T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJjIjoi..."
}
```

### Step 2: Categorize Error
1. **`TransientError`** (e.g. `STORAGE_UNAVAILABLE`, `FFMPEG_TIMEOUT`, `DISK_FULL`):
   - Exhausted 4-8 attempts during an outage or network hiccup.
   - Once dependency recovers, eligible for **Replay**.
2. **`PermanentError`** (e.g. `CORRUPT_CONTAINER`, `UNSUPPORTED_CODEC`, `DURATION_EXCEEDED`):
   - Fails immediately on attempt 1.
   - Replay is only valid if platform configuration or allowlists were modified (requires `{ force: true }`). Otherwise, mark as **Discarded**.
3. **`Unknown Error`**:
   - Capped at 3 retry attempts before parking. Inspect stack trace in `dlq_entries`.

---

## 5. Remediation Commands

### Option A: Replay DLQ Entry
Replay re-adds the exact payload into the origin queue with a new deterministic job ID suffix `--r{n}` (fresh attempts counter):
```bash
curl -X POST \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resetAttempts": true}' \
  "http://localhost:3000/admin/dlq/018f...-uuid/replay"
```
**Outcome:**
- Original entry in `dlq_entries` status becomes `REPLAYED` with `replayed_at = now()`.
- Audit event `dlq.replayed` is appended to `video_events`.
- Job is placed in origin queue (e.g. `transcode-720p`) with fresh backoff policy.

### Option B: Discard DLQ Entry
If the failure is invalid or cannot be processed:
```bash
curl -X DELETE \
  -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/admin/dlq/018f...-uuid"
```
**Outcome:**
- Entry status in `dlq_entries` becomes `DISCARDED`.
- Audit event `dlq.discarded` is recorded.
- Returns HTTP 204 No Content.

### Option C: Reprocess Entire Video (Generation Bump)
When an entire video needs to be re-encoded from scratch (e.g. following transcoder configuration changes):
```bash
curl -X POST \
  -H "Authorization: Bearer $USER_OR_ADMIN_JWT" \
  "http://localhost:3000/v1/videos/018f...-uuid/reprocess"
```
**Outcome:**
- Video status transitions `READY | FAILED | PROCESSING -> PROBING`.
- `generation` bumps (e.g. `g1 -> g2`).
- Fresh probe job enqueued as `${videoId}--probe--g2`.
- Transcodes write to `videos/${videoId}/hls/g2/` without colliding with `g1`.
- `master_playlist_key` switches atomically to `g2` only when the flow reaches `READY`.

### Option D: Systemic Failure Circuit Breaker
When dependency degradation causes systemic failures (> 50% failures over 5 min):
1. **Pause the Affected Queue Immediately**:
   - Follow `docs/runbooks/queue-paused.md` or click **Pause** in Bull Board UI.
2. **Diagnose and Restore Infrastructure**:
   - Verify MinIO/S3, Redis, and PostgreSQL availability.
3. **Resume the Queue**:
   - Click **Resume** in Bull Board.
4. **Bulk Replay Parked DLQ Entries**:
   ```bash
   curl -X POST \
     -H "x-admin-token: $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"resetAttempts": true}' \
     "http://localhost:3000/admin/dlq/replay-all"
   ```

---

## 6. Verification
1. Query `GET /admin/dlq?status=PARKED` — confirm count drops to 0 or only discarded entries remain.
2. Verify re-enqueued jobs appear as `active` or `completed` in the origin queue.
3. Verify videos reach `READY` status with valid playback URLs.
4. Verify `DLQNotEmpty` alert resolves in Prometheus / Alertmanager.

---

## 7. Prevention
1. **Error Classification at Throw Site**: Ensure all worker exceptions throw either `TransientError` or `PermanentError` with standard SDD §6.2 error codes.
2. **Deterministic Replay IDs**: All replays append `--r{n}`, preventing queue collisions while maintaining complete event lineage in `video_events`.
3. **DLQ Mirroring Durability**: Even if Redis restarts, the authoritative `dlq_entries` table in PostgreSQL preserves failed payloads and stack traces indefinitely.
