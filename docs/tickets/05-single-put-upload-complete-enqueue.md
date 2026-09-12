# 05: Upload slice — single presigned PUT → complete + verify → `UPLOADED` → `probe` job enqueued

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Issue | [#5](https://github.com/szebest/taitube-platform/issues/5) |
| Size | M |
| Blocked by | 04 — API skeleton + schema |
| Blocks | 06, 11 |
| Spec | [PRD US-1, US-4](../PRD.md#51-upload) · [PRD FR-1, FR-2](../PRD.md#6-functional-requirements) · [SDD §3.1 Upload flow](../SDD.md#31-upload-multipart-direct-to-storage) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §7 Storage layout](../SDD.md#7-object-storage-layout) · [SDD §9.2 Job identity](../SDD.md#92-job-identity-payload-contracts) · [SDD §20 Job contracts](../SDD.md#20-appendix-job-contracts-code) · [ADR-06](../SDD.md#adr-06-object-storage-minio-locally-cloudflare-r2-in-cloud-backblaze-b2-fallback) · [ADR-09](../SDD.md#adr-09-upload-completion-trigger-explicit-complete-call-server-verification-reconciler) · [ADR-16](../SDD.md#adr-16-enqueue-reliability-idempotent-enqueue-reconciler-mvp-transactional-outbox-phase-4) |

**Status:** done

## What to build
A script (curl or a tiny TS client) calls `POST /v1/uploads` for a ≤ 100 MB file, receives one presigned PUT URL, uploads the bytes **directly to MinIO**, calls `POST /v1/uploads/:id/complete`, and the video flips to `UPLOADED` with a `probe` job waiting in Redis under a deterministic job id. Oversized/mismatched/bad-type uploads are rejected and the object deleted. This lands `packages/storage` (provider-agnostic S3 client, deterministic key builders, presign, head/delete, content-type/cache-control mapping) and `packages/job-contracts` (SDD §20 verbatim) as a by-product.

## Acceptance criteria
- [x] `POST /v1/uploads {filename,sizeBytes,contentType}` → 201 with `strategy: "single"`, a PUT URL with signed `Content-Type`/`Content-Length`, `expiresAt` ≤ 15 min; p95 < 200 ms locally.
- [x] Uploading a body of a different length via the URL fails at MinIO; the correct body succeeds; the API container's network bytes do not grow with file size (assert via `docker stats` or a proxy in the test).
- [x] `complete` performs `HeadObject`, verifies size/type/user cap, CAS `UPLOADING→UPLOADED`, appends `upload.completed`, enqueues `probe` with `jobId = {videoId}--probe--g1`; returns 202. Second `complete` call → 202, no second job (idempotent).
- [x] Mismatch → 422 `UPLOAD_SIZE_MISMATCH`, object deleted, video `REJECTED`; bad type → `UNSUPPORTED_CONTENT_TYPE`; over `MAX_UPLOAD_BYTES` → `UPLOAD_TOO_LARGE` at request time.
- [x] Rate limit 30/min/user on `POST /uploads` returns 429 `RATE_LIMITED`.
- [x] Key layout matches SDD §7 (`raw/{videoId}/source.{ext}`); `.m3u8`/`.ts`/`.jpg`/`.vtt` header mapping unit-tested for later tickets.

## Out of scope
Multipart (11), the probe worker (06), reconciler (17).

## Notes for the implementer
- Strip query strings from presigned URLs in every log line.
- MinIO needs `forcePathStyle`; R2 needs `region: 'auto'` — both via env only, no code branches on provider names.
- Store the original filename as metadata only; keys derive from UUIDs.

## Testing plan
Integration against compose MinIO + Postgres + Redis (job presence asserted via BullMQ `Queue.getJob`); a `scripts/upload.sh` used by humans and by 08's smoke test.

## Open questions
- Verify client-supplied `sha256`? Store now, verify in 11 if cheap.

## Definition of Done
- [x] AC green; `scripts/upload.sh s60` works end-to-end against `make up`.
