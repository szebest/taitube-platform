# Code Review Report: Ticket 13 — Thumbnails as a Non-Blocking Flow Child

**Review Target:** Ticket 13 (`docs/tickets/13-thumbnails-flow-child.md`)  
**Commit Range:** `4e8a4c4..ef96c20`  
**Reviewer:** Antigravity Code Reviewer  
**Date:** 2026-09-04  

---

## 1. Executive Summary

Ticket 13 introduces the `thumbnail` worker stage as a non-blocking child of the BullMQ Flow (`failParentOnFailure: false`, `ignoreDependencyOnFailure: true`). It generates three distinct assets per video:
1. `poster.jpg`: 1280x720 letterboxed image taken at 10% duration (or frame 0 fallback).
2. `sprite.jpg`: 10-column tiled sprite sheet (160x90 per tile) sampled every 5 seconds (configurable via `SPRITE_INTERVAL_SECONDS`).
3. `sprite.vtt`: WebVTT thumbnail cues with `#xywh` spatial coordinates for video scrubber preview.

These assets are uploaded to public object storage with immutable cache headers (`public, max-age=31536000, immutable`). The parent `package` job collects thumbnail results via `getChildrenValues()`, transitions the video with `posterKey` and `spriteKey`, and exposes them via `GET /v1/videos/:id`. The HLS test page showcases interactive hover scrubbing against the sprite sheet and WebVTT cues.

The implementation meets all 4 acceptance criteria, aligns with SDD §8.3 and §9.3, and passes all Vitest and Bun tests.

---

## 2. Spec Axis Findings

### 2.1 Acceptance Criteria Verification

| AC # | Requirement | Status | Verification & Evidence |
|---|---|---|---|
| **AC 1** | `s60` produces poster + 12-frame sprite (2 rows) + VTT with 12 cues of 5 s; `m10` produces 120 frames; VTT validated by a parser test. | **Compliant** | Tested in `packages/ffmpeg/src/__tests__/thumbnail.test.ts` and `apps/worker/src/__tests__/thumbnail-stage.test.ts`. Real FFmpeg execution on `s60.mp4` verified; `parseSpriteVtt()` parser tests validate correct timestamps and `#xywh` fragments. |
| **AC 2** | Thumbnail child runs concurrently with transcodes in BullMQ Flow (start times overlap in `processing_steps`). | **Compliant** | Tested in `apps/worker/src/__tests__/thumbnail-stage.test.ts` (AC 2). Concurrency verified by asserting timestamp overlap between `thumbnail` and `transcode` steps in `processing_steps`. |
| **AC 3** | Forced thumbnail failure -> `package` still runs, video `READY`, `poster_key` null, step `FAILED` with code; renditions unaffected. | **Compliant** | Tested in `thumbnail-stage.test.ts` (AC 3). Child opts specify `failParentOnFailure: false, ignoreDependencyOnFailure: true`. Video transitions to `READY`, `posterKey` remains `null`, and renditions finish `DONE`. |
| **AC 4** | Test page displays poster and hover preview. Screenshot verified in PR (`tools/hls-test-page/hover-preview-screenshot.png`). | **Compliant** | `tools/hls-test-page/index.html` implements canvas demo, WebVTT `#xywh` parser, and dynamic scrubber hover positioning. Screenshot verified present at `tools/hls-test-page/hover-preview-screenshot.png` (329 KB). |

### 2.2 Spec Discrepancies & Resolutions

1. **Sprite Density Configuration (PRD OQ-4):**
   - *Spec Requirement:* Expose sprite density as env (default 1/5 s).
   - *Finding:* `SPRITE_INTERVAL_SECONDS` is defined in `packages/config/src/index.ts` (default: 5) and documented in `.env.example`.
   - *Resolution:* Verified that `createThumbnailProcessor` accepts `spriteIntervalSec` dependency with fallback to `process.env['SPRITE_INTERVAL_SECONDS'] || '5'`.

---

## 3. Standards Axis Findings

### 3.1 Ports & Adapters Architecture
- `apps/worker/src/stages/thumbnail.ts` depends exclusively on abstract interfaces: `QueueJob`, `Repositories`, `StorageClient`, `Logger`.
- Storage uploads utilize `getHeaderMapping` from `@vp/storage` for standard `image/jpeg` and `text/vtt` content types and caching headers.

### 3.2 Dual Runtime Parity
- No `Bun.*` APIs or runtime-specific modules are imported.
- All thumbnail tests run identically under Node 24 (`vitest`) and Bun 1.4 (`bun test`).

### 3.3 State Changes & Fencing Tokens (AGENTS.md Rule 6)
- **Previous Issue:** `apps/worker/src/stages/thumbnail.ts:173-194` previously invoked `repositories.videos.transition` *before* `repositories.steps.complete({ lockToken })`. If a zombie worker was fenced out on completion, the video row had already been mutated with thumbnail keys and `thumbnail.completed` event appended.
- **Resolution Applied:** Moved `repositories.steps.complete` to execute **first**. If `comp.fenced` is true, the stage logs a warning and returns immediately without mutating the video record. Only authorized workers update the video row.

### 3.4 Modular Repositories & File Length Discipline (AGENTS.md Rule 5)
- `apps/worker/src/stages/thumbnail.ts`: 224 lines (below target <= 250 lines, strictly under 400 lines / 10 KB).
- `packages/ffmpeg/src/thumbnail.ts`: 384 lines, 9.7 KB (strictly under 400 lines / 10 KB limit).

### 3.5 Fowler Code Smells Analysis
- **Duplicated Code (Addressed):** Refactored duplicated `Math.ceil(durationSec / intervalSec)` and row calculations across `buildSpriteArgs`, `generateSpriteVtt`, and `runFfmpegThumbnail` into a single shared helper: `calculateSpriteGrid()`.

---

## 4. Identified Issues & Severity

| Severity | Item | File / Location | Description & Remediation |
|---|---|---|---|
| **Blocker (Fixed)** | Zombie Fencing Race in Thumbnail Worker | `apps/worker/src/stages/thumbnail.ts:172-194` | `repositories.videos.transition` was called prior to `steps.complete`. Reordered to complete step first and abort on `comp.fenced`. Fixed in review commit. |
| **Nitpick (Fixed)** | Duplicated Grid Math | `packages/ffmpeg/src/thumbnail.ts:98,165,350` | Extracted `calculateSpriteGrid` helper function to centralize grid dimension calculations. Fixed in review commit. |
| **Nitpick** | FFmpeg Scaling for 4K Input | `packages/ffmpeg/src/thumbnail.ts:110` | 4K input is scaled down in filter chain (`scale=160:90`). Works as intended; future optimization could downscale once if extracting high-res posters and sprites from 4K sources. |

---

## 5. Final Verdict

**Status:** **APPROVED** (with zombie worker fencing race fixed)

Ticket 13 fulfills all requirements, reliably integrates thumbnails into BullMQ Flows as a fault-tolerant non-blocking child, provides hover-scrub preview functionality, and respects local-first and dual-runtime principles.
