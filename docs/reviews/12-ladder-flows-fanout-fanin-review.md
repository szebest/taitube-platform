# Code Review Report: Ticket 12 — Fan-out / Fan-in with BullMQ Flows

**Review Target:** Ticket 12 (`docs/tickets/12-ladder-flows-fanout-fanin.md`)  
**Commit Range:** `4e8a4c4..ef96c20`  
**Reviewer:** Antigravity Code Reviewer  
**Date:** 2026-09-04  

---

## 1. Executive Summary

Ticket 12 implements the core BullMQ Flow fan-out and fan-in architecture for adaptive-bitrate video transcoding. Transcode jobs for each ladder rendition (`transcode-1080p`, `transcode-720p`, `transcode-480p`) are scheduled as concurrent child jobs of a parent `package` job. The parent job stays in `waiting-children` until all transcode tasks finish, reads children outputs via `job.getChildrenValues()`, HEAD-verifies each rendition playlist, and writes a multi-variant HLS master playlist before transitioning the video to `READY`.

The implementation faithfully satisfies all 6 acceptance criteria and the SDD §9.3 flow blueprint. Quality gates pass unconditionally under both Vitest and Bun test environments.

---

## 2. Spec Axis Findings

### 2.1 Acceptance Criteria Verification

| AC # | Requirement | Status | Verification & Evidence |
|---|---|---|---|
| **AC 1** | `s60` (1080p) produces 3 rendition directories and master with 3 `EXT-X-STREAM-INF` entries; HLS player lists levels. | **Compliant** | Verified in `apps/worker/src/__tests__/fanout-fanin-flow.test.ts`. Test page `tools/hls-test-page/index.html` updated to explicitly enumerate quality levels and track `LEVEL_SWITCHED` events. |
| **AC 2** | `p720` produces 2 variants; `sd360` produces 1 variant (preserving smallest 480p rung); ladder stored on video; renditions progress `PENDING` -> `RUNNING` -> `DONE` independently. | **Compliant** | Verified in `apps/worker/src/__tests__/probe-stage.test.ts` and `apps/worker/src/__tests__/fanout-fanin-flow.test.ts`. `renditions` table entries update independently with status transitions. |
| **AC 3** | `package` parent sits in `waiting-children` until the last child completes; never runs with missing child. | **Compliant** | Asserted via `packageQueue.getJobState(packageJobId)` remaining in `'waiting-children'` as 1080p, 720p, and thumbnail complete, executing only after 480p finishes. |
| **AC 4** | Deterministic child job IDs `{videoId}--transcode--{r}--g{generation}`; re-running probe creates no duplicate children. | **Compliant** | Implemented using `ids.transcode(videoId, r.name, generation)` in `packages/job-contracts/src/ids.ts`. Deduplication tested in `fanout-fanin-flow.test.ts`. |
| **AC 5** | Simulated permanent failure in `transcode-480p` fails parent via `failParentOnFailure: true`; video marked `FAILED` with error code; partial outputs preserved. | **Compliant** | Tested in `fanout-fanin-flow.test.ts` (AC 5). `failParentOnFailure: true` and `removeDependencyOnFailure: false` configured on all transcode children. |
| **AC 6** | `AVERAGE-BANDWIDTH` computed from measured `bytes * 8 / duration`; `CODECS` formatted from profile/level (`avc1.640029`, `avc1.64001f`, `avc1.4d401f`). | **Compliant** | `generateMasterPlaylist` in `packages/ffmpeg/src/master.ts` calculates average bandwidth from measured results and derives RFC 6381 codec strings via `getAvcCodecString`. |

### 2.2 Spec Discrepancies & Resolutions

1. **Video FPS Persistence & Master Playlist Frame-Rate:**
   - *Spec Requirement:* Master playlist emits accurate `FRAME-RATE` derived from source probe.
   - *Finding:* `apps/worker/src/stages/probe.ts` previously omitted `fps` from the `repositories.videos.transition` patch payload. Consequently, `apps/worker/src/stages/package.ts` defaulted to `24`.
   - *Resolution:* Added `fps` to `VideoRecord` / `NewVideoInput` in `@vp/core/repositories`, mapped in `postgres-video-repository` and `in-memory-video-repository`, patched in `probe.ts`, and parsed in `package.ts`.

2. **Master Playlist Fixture Snapshot Testing:**
   - *Spec Requirement:* Ticket 12 testing plan specified: "snapshot the master for each fixture".
   - *Finding:* Unit tests in `packages/ffmpeg/src/__tests__/transcode.test.ts` asserted substrings with `.toContain` but lacked an inline snapshot.
   - *Resolution:* Added `expect(master).toMatchInlineSnapshot(...)` matching the SDD §8.4 master playlist format.

3. **Scope Creep Note:**
   - *Finding:* During the development of Ticket 12, commits `3bcf093`, `374ab87`, and `40e511a` introduced the full Hexagonal Architecture refactoring (`@vp/core`, `@vp/adapters`, domain services). While this established architectural consistency across the repository, it was technically outside the minimal vertical slice of Ticket 12.

---

## 3. Standards Axis Findings

### 3.1 Ports & Adapters Architecture
- **Port Inversion:** Concrete SDKs (`ioredis`, `bullmq`, `@aws-sdk/client-s3`, `drizzle-orm`, `postgres`) are strictly isolated inside `adapters/` and composition roots (`apps/api/src/app.ts`, `apps/worker/src/runner.ts`).
- **Worker Stages:** `apps/worker/src/stages/probe.ts`, `package.ts`, and `transcode.ts` only import `FlowProducerPort`, `JobQueue`, `Repositories`, and `StorageClient` from `@vp/core/ports`.
- **In-Memory Parity:** `InMemoryFlowProducer` and `InMemoryJobQueue` emulate parent-child dependencies and state transitions (`waiting-children` -> `waiting` -> `completed`) without Redis.

### 3.2 Dual Runtime Parity
- All worker logic and shared packages execute under Node 24 (`vitest run`) and Bun 1.4 (`bun test`).
- No `Bun.*` APIs are used in worker or shared code.
- Test suites pass 135/135 tests under `bun test` and 130/130 tests under `vitest run`.

### 3.3 State Changes & Fencing Tokens
- Transitions use CAS helpers: `PROBING` -> `PROCESSING` in probe; `PROCESSING` -> `READY` in package.
- Step execution claims a UUIDv7 fencing `lockToken`. Completion verifies `!comp.fenced` before transitioning the video record or dispatching downstream notifications.

### 3.4 Error Taxonomy
- Error classification uses `PermanentError` and `TransientError` from `@vp/errors`.
- Transcode stage updated to use `ErrorCodes.FFMPEG_FAILED` and `ErrorCodes.SOURCE_MISSING` rather than string literals.

### 3.5 Fowler Code Smells Analysis
- **Primitive Obsession (Addressed):** Fixed raw string literals `'FFMPEG_FAILED'` and `'SOURCE_MISSING'` in `transcode.ts` by using `ErrorCodes` constants.
- **Speculative Generality / Dead Code (Warning):** `apps/worker/src/stages/probe.ts:312-340` retained an `else if (getQueue)` fallback branch for single-rendition transcode jobs. Since BullMQ Flows are now mandatory, this legacy fallback can be deprecated.

---

## 4. Identified Issues & Severity

| Severity | Item | File / Location | Description & Remediation |
|---|---|---|---|
| **Warning** | Strict File Size Exceeded | `apps/worker/src/stages/probe.ts` (11.9 KB) | Exceeds the 10 KB file discipline limit. Consider extracting ffprobe validation and metadata extraction into a dedicated helper module. |
| **Warning** | Leaky BullMQ Cast in Admin Route | `apps/api/src/routes/admin/queues.ts:48` | Uses `(q as any).getRawQueue?.() ?? q` to unpack BullMQ instance for Bull Board. Acceptable for admin UI composition root, but should be formalized in adapter. |
| **Nitpick** | Legacy Fallback Branch | `apps/worker/src/stages/probe.ts:312-340` | `if (flowProducer) ... else if (getQueue)` branch is redundant since all pipeline topologies support flow producers. |

---

## 5. Final Verdict

**Status:** **APPROVED** (with minor cleanup applied)

Ticket 12 satisfies all functional acceptance criteria, passes all automated unit and integration tests across both Vitest and Bun runtimes, and adheres to the hexagonal architecture constraints.
