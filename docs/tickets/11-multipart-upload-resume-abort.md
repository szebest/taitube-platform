# 11: Multipart upload with resume and abort — a 4 GB file survives a client crash at 50 %

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | M–L |
| Blocked by | 05 — Upload slice |
| Blocks | 17, 28 |
| Spec | [PRD US-2, US-3](../PRD.md#51-upload) · [PRD FR-1](../PRD.md#6-functional-requirements) · [SDD §3.1 Upload (multipart)](../SDD.md#31-upload-multipart-direct-to-storage) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §14.2 S2 Large file](../SDD.md#142-scenarios) · [SDD §17 R2 facts](../SDD.md#17-fact-sheet-verified-2026-09-03) |

**Status:** ready-for-agent

## What to build
For files above the single-PUT threshold, `POST /v1/uploads` opens a multipart upload and returns the first batch of presigned part URLs; the client uploads parts in parallel, can be killed and later ask `GET /v1/uploads/:id` for the parts already stored (ETags from `ListParts`) plus `POST …/parts?from=&count=` for fresh URLs, then completes with the part list; `DELETE /v1/uploads/:id` aborts and marks the video `ABANDONED`. A reference upload client (TS, in `tools/`) demonstrates the whole flow and is reused by k6 later.

## Acceptance criteria
- [ ] Part size = `clamp(ceil(size/1000), 8 MiB, 64 MiB)`; ≤ 10 000 parts; batches of ≤ 100 URLs; URLs expire in 15 min.
- [ ] Reference client uploads a 4 GB sparse/synthetic file with concurrency 4; killed at ~50 % and restarted, it resumes from `ListParts`, completes, and the video reaches `READY` (using the `l30` fixture as the source for realism, or a padded file for size).
- [ ] `complete` with wrong/missing ETags → 422 with a clear code; after success `HeadObject` size equals declared size, else `REJECTED` and the object deleted.
- [ ] `DELETE` → `AbortMultipartUpload`, upload `ABORTED`, video `ABANDONED`; `GET` after that → 410/404 with `UPLOAD_NOT_OPEN`.
- [ ] API RSS stays flat (< 300 MB) throughout — the API never buffers file bytes.
- [ ] Works unchanged against R2 when `STORAGE_E2E_R2=1` (opt-in test, documents any R2-specific behaviour).

## Out of scope
Abandoned-upload sweeper (17), bucket lifecycle (already in 01).

## Notes for the implementer
- R2: no POST-policy uploads, presign ≤ 7 days; MinIO: `forcePathStyle`. No provider-specific code paths.
- Store `sha256` if the client sends it; verify only if the provider supports a checksum on single PUT.

## Testing plan
Integration on compose MinIO with a 300 MB generated file (CI) and a manual 4 GB run (documented); resume test kills the client process mid-way.

## Open questions
- Should part URLs be pre-issued for all parts up to 1 000 to save round-trips? Keep batching; measure in 28 (S2).

## Definition of Done
- [ ] AC green; reference client documented; OpenAPI updated.
