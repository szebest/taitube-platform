# Runbook: Worker Temp Disk High

## 1. Overview & Architecture
Transcode and thumbnail workers write intermediate media files (temporary raw downloads, transcode segments, sprite sheets) to local temporary directories under `/tmp/vp/*` (SDD §12.2, §14.2).

Per SDD §12.2:
- 1080p workers have an 8 GiB emptyDir volume limit (`8e9` bytes).
- The streaming segment uploader (`packages/server/ffmpeg/src/segment-uploader.ts`) uploads segments to S3/R2 as they finish encoding and removes them immediately, keeping local disk usage strictly bounded to `sourceSize + 3 * maxSegmentBytes`.

If `worker_tmp_bytes` exceeds 80% of the 8 GB limit (`6.4 GB`) for > 5 minutes, the `WorkerTmpDiskHigh` alert fires. This prevents worker pods from crashing with `ENOSPC` or Kubernetes eviction.

---

## 2. Trigger Alert
- **Alert Name**: `WorkerTmpDiskHigh`
- **Expression**: `worker_tmp_bytes / 8e9 > 0.8`
- **Severity**: `warning`
- **Duration**: `5m`

---

## 3. Dashboards to Open
- **Workers Dashboard**: `/d/workers` — Check "Worker Temp Disk Usage (bytes)" panel.

---

## 4. Diagnosis & Remediation Steps

### Step 1: Identify the Affected Stage
Inspect the alert labels or query Prometheus:
```promql
topk(3, worker_tmp_bytes / 8e9)
```

### Step 2: Inspect Disk Usage Inside Worker Container
Check disk contents on the running worker:
```bash
# Docker Compose
docker compose exec worker-<stage> du -sh /tmp/vp/*

# Kubernetes
kubectl exec -it <pod-name> -c worker -- du -sh /tmp/vp/*
```

### Step 3: Check for Stalled Segment Uploads or Orphaned Dirs
Common root causes:
1. **Slow Storage Uploads**: If storage writes are backed up, encoded segments accumulate faster than they can be uploaded and deleted.
   - Check `storage_op_duration_seconds{op="put"}` for latency spikes.
2. **Orphaned Temporary Directories**: If a previous worker process crashed without running cleanup handlers, directories might linger.
   - Housekeeping worker runs `tmp-sweep` every 30 minutes (`*/30 * * * *`) to remove orphaned dirs older than 2 hours.
   - Run manual cleanup if disk is critically full (> 95%):
     ```bash
     find /tmp/vp -mindepth 1 -mmin +30 -exec rm -rf {} +
     ```
3. **Unexpected Large Sources**: Sources larger than 4 GB should use streaming downloads. Ensure `MAX_SOURCE_SIZE_BYTES` is enforced at upload admission.

---

## 5. Verification
1. Confirm `worker_tmp_bytes` drops below 6.4 GB (`0.8 * 8e9`).
2. Verify transcoding jobs proceed without `DISK_FULL` / `ENOSPC` errors.
3. Alert `WorkerTmpDiskHigh` resolves.
