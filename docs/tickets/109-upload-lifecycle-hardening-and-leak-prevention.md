# 109: Upload lifecycle hardening — incomplete multipart abort, reduced abandonment threshold, adaptive part sizing & client-side abort

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 05 - Single PUT upload · 11 - Multipart upload · 17 - Housekeeping reconciler · 93 - Creator Studio as its own app |
| Blocks | — |
| Spec | [SDD §3.1 Upload](../SDD.md#31-upload-multipart-direct-to-storage) · [SDD §9.8 Housekeeping](../SDD.md#98-housekeeping-job-schedulers) · [SDD ADR-09](../SDD.md#adr-09--upload-completion-trigger-explicit-complete-call--server-verification--reconciler) |

**Status:** ready

> **Why.** (written by Gemini, to be verified)
> While production Cloudflare R2 carries a lifecycle rule to abort incomplete multiparts after 1 day and the `reconcile-uploads` worker runs every 15 minutes, four operational gaps remain in our upload lifecycle:
> 1. **Local environment parity gap**: `infra/compose/minio-init.sh` configures object expiration (`--expire-days 7`), but omits `--abort-incomplete-multipart-days 1`. Incomplete or aborted multipart uploads in local developer environments and CI smoke tests linger in Docker MinIO volumes indefinitely.
> 2. **Stale upload hold time (24h threshold)**: The reconciler currently waits 24 hours (`uploadingThresholdMs`) before marking an upload `ABANDONED` and issuing `AbortMultipartUpload`. Because presigned URLs expire in 15–60 minutes, waiting 24 hours retains multi-gigabyte uncompleted chunks in object storage far longer than necessary.
> 3. **Suboptimal part sizing algorithm**: `calculatePartSize` uses a naive `sizeBytes / 1000` formula clamped to bounds. This forces medium and large uploads into hundreds or thousands of small parts (e.g. 1,000 parts for an 8 GB file), resulting in massive database row churn (`upload_parts`), excessive HMAC presigned URL generation, and high S3 multipart assembly latency. Furthermore, it lacks a mathematical guarantee against exceeding S3's strict 10,000 part ceiling on massive files.
> 4. **No immediate client-side abort on browser unload or cancellation**: When a creator cancels an in-progress upload in Creator Studio or closes their browser tab, no `DELETE /v1/uploads/:id` request is dispatched. The upload relies entirely on future reconciler sweeps rather than cleaning up storage immediately.

## What to build (written by Gemini, to be verified)

### 1. Local MinIO Lifecycle Rule Parity
- In `infra/compose/minio-init.sh`, configure the incomplete multipart lifecycle rule on the `raw` bucket:
  ```bash
  mc ilm rule add --expire-days 7 --abort-incomplete-multipart-days 1 local/raw
  ```
- Verify parity with Cloudflare R2's `cloudflare_r2_bucket_lifecycle.raw` rule.

### 2. Configurable and Tightened Reconciler Abandonment Threshold
- In `@vp/env-schema` and `AppConfig`, expose `UPLOAD_ABANDONED_THRESHOLD_HOURS` with a sensible default of 4 hours (reduced from 24 hours), preserving headroom for slow uploads while releasing stale storage 6x faster.
- Update `runReconcileUploads` in `apps/server/worker/src/stages/housekeeping/reconcile-uploads.ts` and its options wiring in `apps/server/worker/src/composition/stages.module.ts` to respect this configured threshold.
- Ensure `abortMultipartUpload` in the reconciler and `upload-abort.ts` is idempotent: handle `NoSuchUpload` or 404 gracefully if S3/R2 has already purged the session.

### 3. Adaptive, Block-Aligned Dynamic Part Sizing
- In `packages/server/storage/src/multipart.ts`, replace the static 1/1000th divisor with an adaptive algorithm:
  - **Optimal Target Part Budget**: Target ~64–128 parts (the sweet spot providing full parallel saturation for 4–8 concurrent client workers without request flooding).
  - **S3 Protocol Safety Bounds**:
    - Absolute minimum: 5 MiB (`S3_MIN_PART_SIZE`).
    - Absolute maximum part count: 10,000 (`S3_MAX_PARTS`).
    - Enforce `partSize >= Math.ceil(sizeBytes / S3_MAX_PARTS)` so massive multi-gigabyte or multi-terabyte files can never violate S3's 10,000 part ceiling.
  - **Block Alignment**: Round part sizes up to standard power-of-two / 1 MiB boundaries (e.g. 8 MiB, 16 MiB, 32 MiB, 64 MiB) to optimize filesystem reading, network socket buffering, and chunk streaming.
  - Clamped between `minBytes` (default 8 MiB) and `maxBytes` (default 64 MiB), with the S3 10,000-part ceiling taking ultimate precedence.

### 4. Immediate Client-Side Abort in Upload Client and Studio UI
- In `packages/server/upload-client/src/client.ts`:
  - When aborting an active upload, immediately trigger `AbortController.abort()` to terminate in-flight chunk HTTP requests, followed by `DELETE /v1/uploads/:id`.
- In Creator Studio upload flow (`apps/client/studio`):
  - On explicit upload cancellation: trigger the abort sequence immediately.
  - On page unload / unmount during an active upload: use `fetch(url, { method: 'DELETE', keepalive: true })` so the browser completes the abort request even if the tab closes.

## Acceptance criteria (written by Gemini, to be verified)

- [ ] `infra/compose/minio-init.sh` applies `--abort-incomplete-multipart-days 1` to `local/raw`, and `mc ilm ls local/raw` confirms the rule is active. (written by Gemini, to be verified)
- [ ] `uploadingThresholdMs` is configurable through environment schema and defaults to 4 hours; `reconcile-uploads` transitions idle uploads past this threshold to `ABANDONED` and calls `abortMultipartUpload`. (written by Gemini, to be verified)
- [ ] `calculatePartSize` dynamically scales part size targeting 64–128 parts, aligns to 1 MiB block boundaries, respects min/max bounds, and mathematically prevents part count from exceeding S3's 10,000 limit. (written by Gemini, to be verified)
- [ ] Dedicated unit tests in `packages/server/storage/src/__tests__/multipart.test.ts` verify the dynamic part calculation across various file sizes (100 MB, 1 GB, 8 GB, 64 GB, 1 TB). (written by Gemini, to be verified)
- [ ] Studio upload component dispatches `DELETE /v1/uploads/:id` upon user cancellation or navigation away with `keepalive: true`. (written by Gemini, to be verified)
- [ ] Reconciler and upload abort handlers treat `NoSuchUpload` from storage as a non-fatal success, ensuring idempotent aborts. (written by Gemini, to be verified)

