# 12: Fan-out / fan-in with BullMQ Flows — 1080p / 720p / 480p renditions and a multi-variant master

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Issue | [#12](https://github.com/szebest/taitube-platform/issues/12) |
| Size | L |
| Blocked by | 07 — Playable READY video |
| Blocks | 13, 14, 16, 22, 23 |
| Spec | [PRD US-5, US-6](../PRD.md#52-processing) · [PRD FR-4, FR-6](../PRD.md#6-functional-requirements) · [SDD §3.2 Pipeline](../SDD.md#32-processing-pipeline-fan-out-fan-in) · [SDD §9.1 Queue topology](../SDD.md#91-queue-topology) · [SDD §9.3 Flows (code)](../SDD.md#93-fan-out-fan-in-with-flows) · [SDD §8.1 Ladder table](../SDD.md#81-probe) · [SDD §8.4 Master playlist](../SDD.md#84-master-playlist-generated-by-package-not-by-ffmpeg) · [ADR-08](../SDD.md#adr-08-transcode-parallelism-one-job-per-rendition-fan-out-chunked-transcoding-as-stretch) |

**Status:** done

## What to build
Probe now creates a BullMQ Flow: a `package` parent with one child per ladder rendition on its own queue (`transcode-1080p`, `transcode-720p`, `transcode-480p`). Three worker processes (one per queue) encode in parallel; `package` runs only when all children completed, reads their results via `getChildrenValues()`, HEAD-verifies every rendition playlist, writes a master with all variants (highest first, correct `BANDWIDTH`/`AVERAGE-BANDWIDTH`/`RESOLUTION`/`FRAME-RATE`/`CODECS`) and flips `READY`. A 720p source yields two variants, a 360p source one. A child that fails permanently fails the parent (`failParentOnFailure`), and the video becomes `FAILED` with the first child's error code.

## Acceptance criteria
- [x] `s60` (1080p) → three rendition directories, master with three `EXT-X-STREAM-INF` entries; hls.js in the test page lists 3 levels and switches when bandwidth is throttled (DevTools).
- [x] `p720` → 2 variants; `sd360` → 1 variant (480p rung, upscaled from 360p by rule "always keep the smallest rung"); `ladder` stored on the video; `renditions` rows status progress `PENDING→RUNNING→DONE` independently.
- [x] `package` is in `waiting-children` until the last child completes (assert state via `Queue.getJobState`); it never runs with a missing child.
- [x] Deterministic child job ids `{videoId}--transcode--{r}--g1`; re-running probe (re-enqueue same job id) adds no duplicate children.
- [x] Simulated permanent failure in `transcode-480p` (feature flag in test) → parent fails → video `FAILED`, `error_code` from the child, other children's outputs left in place (documented).
- [x] `AVERAGE-BANDWIDTH` computed from measured bytes/duration; `CODECS` from profile/level (`avc1.640029`, `avc1.64001f`, `avc1.4d401f`).

## Out of scope
Thumbnail child (13), segment streaming (14), DLQ handling of the failed parent (16).

## Notes for the implementer
- Three separate queues (not one with a `rendition` field) is deliberate — per-queue KEDA sizing in 26.
- Keep the single-rendition path from 07 as the `sd360` case; no separate code path.

## Testing plan
Integration with all three transcode workers in-process; unit for master generation; snapshot the master for each fixture.

## Open questions
- Should a failed 1080p still ship 720p/480p (`failParentOnFailure: false` for the top rung)? Recorded as a product decision to revisit after 20's E2E review.

## Definition of Done
- [x] AC green; SDD §9.3 code and the implementation are identical (or the SDD is updated in the same PR).

## Code Review
- **Status:** Approved (with minor cleanups applied)
- **Review Report:** [Review Report](../reviews/12-ladder-flows-fanout-fanin-review.md)
- **Key Findings:**
  - Full compliance with AC 1–6 and SDD §9.3 flow topology.
  - Video FPS persistence wired through `VideoRecord` into `package` stage for accurate `FRAME-RATE` generation.
  - Master playlist inline snapshot test added for s60 fixture in `packages/ffmpeg/src/__tests__/transcode.test.ts`.
  - HLS level enumeration and ABR level switch event tracking implemented in `tools/hls-test-page/index.html`.
  - Transcode stage error classification updated to use typed `ErrorCodes` enum constants.

