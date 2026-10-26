# 109: Upload lifecycle hardening - idempotent abort, part sizing, and Studio cancel

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 05 - Single PUT upload · 11 - Multipart upload · 17 - Housekeeping reconciler · 93 - Creator Studio as its own app |
| Blocks | — |
| Spec | [SDD §3.1 Upload](../SDD.md#31-upload-multipart-direct-to-storage) · [SDD §9.8 Housekeeping](../SDD.md#98-housekeeping-job-schedulers) · [SDD ADR-09](../SDD.md#adr-09--upload-completion-trigger-explicit-complete-call--server-verification--reconciler) |

**Status:** in-progress

> **Why.** Three gaps in the upload lifecycle are real; a fourth the first draft of this ticket named is not.
>
> 1. **A multipart session that storage already dropped cannot be aborted.** `abortMultipartUpload` in
>    `S3MultipartStorage` maps every SDK error to `STORAGE_UNAVAILABLE`, so `NoSuchUpload` (HTTP 404) makes
>    `DELETE /v1/uploads/:id` fail and leaves the upload `OPEN` and the video `UPLOADING` until the reconciler gets to it.
> 2. **Part sizing is a thousandth of the file clamped to 8-64 MiB** (`calculatePartSize`), so every upload from
>    8 GiB down to the 4 GiB cap sits on the 8 MiB floor: a 4 GiB file is 512 parts, 512 `upload_parts` rows and
>    512 presigned URLs. Nothing guards the 10 000-part ceiling either: it holds only because `MAX_UPLOAD_BYTES`
>    (4 GiB) is far below 10 000 x 64 MiB.
> 3. **Studio can neither cancel an upload nor abort one it abandons.** `uploadVideo` sends the parts one at a time
>    with `axios`, passes no signal, and has no cancel control; closing the tab or leaving the page leaves the
>    multipart session to the 24 h reconciler.
>
> What it does not need: local MinIO already matches R2 (see Decisions), and the 24 h abandonment threshold is the
> upload session's own lifetime, so shortening it would abandon uploads that are still resumable.

## What to build

### 1. Idempotent multipart abort

- `S3MultipartStorage.abortMultipartUpload` (`packages/server/adapters/s3/s3-multipart-storage.ts`) returns `ok` when
  the SDK error is `isNotFound` (`s3-config.ts`: `NotFound`, `NoSuchKey` or any 404, which covers `NoSuchUpload`), and
  `STORAGE_UNAVAILABLE` for everything else. The error is classified at the SDK call, as rule 7 asks.
- The multipart-storage contract suite
  (`packages/server/adapters/__tests__/contract/multipart-storage.contract.ts`) gains "aborting an upload that is
  already gone succeeds", run over the in-memory double (already idempotent) and the S3 adapter.
- `abortUpload` (`apps/server/api/src/services/upload-abort.ts`) and `runReconcileUploads` need no change: the first
  already returns the storage failure, the second already logs a failed abort and moves on.
- `housekeeping.stuckUploadingAfterMs` (`packages/server/env-schema/src/tuning.ts`) is derived from
  `UPLOAD_SESSION_TTL_SECONDS` instead of a second `MS_PER_DAY`, so the reconciler cannot abandon a session its owner
  may still resume.

### 2. Part sizing

`calculatePartSize` (`packages/server/storage/src/multipart.ts`), still pure and still taking `{ minBytes, maxBytes }`:

- target about 128 parts: `ceil(sizeBytes / 128)`, rounded up to a whole MiB;
- clamp to `[max(minBytes, S3_MIN_PART_SIZE), maxBytes]`, with `S3_MIN_PART_SIZE` = 5 MiB, the protocol floor, exported
  beside `S3_MAX_PARTS` = 10 000;
- then `max(result, ceil(sizeBytes / S3_MAX_PARTS))`, rounded up to a whole MiB: the part ceiling beats `maxBytes`.

With the 8-64 MiB defaults a 100 MB file stays at 8 MiB, 1 GiB is 8 MiB (128 parts), 4 GiB is 32 MiB (128 parts),
and a file past 8 GiB is 64 MiB. The part size is stored with the upload, so uploads already open keep theirs.
`calculateTotalParts` is unchanged. SDD §3.1 line 174 states the formula and gets the new one; the PRD and the
README already say 8-64 MiB and stay.

### 3. Studio cancel and abandon

- `RequestOptions` in `@vp/api-client` (`packages/client/api-client/src/request.ts`) gains `keepalive?: boolean`,
  passed to `fetch`, so the abort can outlive the page.
- `uploadVideo` (`apps/client/studio/src/features/upload/api/upload-video.ts`) takes an `AbortSignal` and hands it to
  every `axios.put` and to the part-URL requests; once `startUpload` has returned an `uploadId`, an aborted or failed
  upload sends `DELETE /v1/uploads/:id` through the API client and swallows an error from that call (the reconciler is
  the backstop). A completed upload never aborts.
- `useUploadVideo` exposes `cancel()`; the upload form shows a Cancel control while the mutation is pending, through
  `@vp/ui`.
- While an upload is pending, the hook listens for `pagehide` and, when `event.persisted` is false, sends the same
  DELETE with `keepalive: true`. Leaving the page inside the app (unmount while pending) calls `cancel()`.

## Acceptance criteria

- [ ] `abortMultipartUpload` on a session storage has dropped returns `ok` over the in-memory double and the S3 adapter
      (a fake client throwing a 404 `NoSuchUpload`); any other SDK error is still `STORAGE_UNAVAILABLE`. `DELETE
      /v1/uploads/:id` on such an upload returns 204 and leaves the upload `ABORTED` and the video `ABANDONED`.
- [ ] `stuckUploadingAfterMs` equals `uploadSessionTtlSeconds * 1000` in `AppConfig`, asserted in a spec.
- [ ] `calculatePartSize` is table-tested (`it.each`) at 100 MB, 1 GiB, 4 GiB, 8 GiB and 64 GiB with the default bounds
      and at 1 TiB with `maxBytes` of 64 MiB: every result is a whole number of MiB, never below 5 MiB or `minBytes`,
      and `calculateTotalParts` never exceeds 10 000 (the 1 TiB case exceeds `maxBytes` to hold it).
- [ ] A Studio spec cancels a multipart upload after the first part: no further part is sent and `DELETE
      /v1/uploads/:id` is sent once. A spec fires `pagehide` (`persisted: false`) and sees the DELETE with
      `keepalive: true`; with `persisted: true` or after completion, none.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, with output in the PR.

## Out of scope

- A lifecycle rule for the local MinIO `raw` bucket: `mc` has no such flag, and MinIO expires stale multipart uploads
  itself (see Decisions).
- A shorter abandonment threshold and an env key for it.
- Parallel part uploads in Studio and a resume path in Studio (`getResumeInfo` and `existingUploadId` exist only in
  `@vp/upload-client`).
- Changes to `@vp/upload-client`: its `signal` abort deliberately leaves the session open so a later run resumes it
  (`client.test.ts`, the crash-at-50 % case), and `--abort <uploadId>` already sends the DELETE.

## Testing plan

- Contract: the new abort case in `multipart-storage.contract.ts` for both adapters; the S3 adapter spec for the 404
  mapping and for an unrelated error still failing.
- Unit: `multipart.test.ts` as an `it.each` table; the `AppConfig` assertion for the threshold.
- Studio: `upload-video.test.ts` (signal reaches the PUTs, DELETE sent once, none after completion) and the hook's
  DOM spec (`pagehide`, unmount) through the suite's render helper.

## Open questions

- Decided: no `--abort-incomplete-multipart-days` for local MinIO. `mc ilm rule add` has no such flag (checked with
  `--help` on the image pinned in `infra/compose/docker-compose.yml`), and MinIO does not apply that S3 lifecycle
  action; it removes stale multipart uploads on its own, which is the parity with R2's one-day rule. `minio-init.sh`
  stays as it is.
- Decided: keep the reconciler's 24 h `UPLOADING` threshold and add no `UPLOAD_ABANDONED_THRESHOLD_HOURS`. Nothing
  touches the video row while parts are uploaded, so the idle clock runs from creation and a 4 h threshold would
  abandon a slow upload that is still inside its 24 h session (a 20 GiB file at 10 Mbit/s takes 4.5 h). The value is a
  tuning constant in `tuning.ts`, not an env key, and the schema is closed, so a new key would also need
  `.env.example`, compose and k8s entries for no operator need.
- Decided: abort idempotency lives in the S3 adapter, where the SDK error is seen, not in `upload-abort.ts` or the
  reconciler, which only see a `Result`.
- Decided: target 128 parts, not 64-128, and round to a whole MiB, not a power of two. The 64-128 range assumed 4-8
  concurrent clients, but Studio uploads one part at a time and the CLI defaults to four; a power of two buys nothing
  on S3. 1 TiB and 64 GiB are tested by passing the bounds in, since `MAX_UPLOAD_BYTES` caps real uploads at 4 GiB.
- Decided: `@vp/upload-client` is untouched (see Out of scope).
- Decided: tab close sends the DELETE with `keepalive` even though a resumed upload would have survived a crash,
  because Studio has no resume path, so a closed tab's session can never be picked up again. `persisted: true`
  (bfcache) is skipped because the page can come back.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
