# 13: Thumbnails as a non-blocking Flow child — poster, sprite sheet and WebVTT

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | S–M |
| Blocked by | 12 — Flows fan-out/fan-in |
| Blocks | 20 |
| Spec | [PRD FR-5](../PRD.md#6-functional-requirements) · [PRD OQ-4](../PRD.md#12-open-questions-to-resolve-during-phase-01) · [SDD §8.3 Thumbnails](../SDD.md#83-thumbnails) · [SDD §7 Storage layout (thumbs)](../SDD.md#7-object-storage-layout) · [SDD §9.3 (`ignoreDependencyOnFailure`)](../SDD.md#93-fan-out-fan-in-with-flows) |

**Status:** ready-for-agent

## What to build
Alongside the rendition children, the Flow gets a `thumbnail` child that produces `poster.jpg` (1280×720 letterboxed, taken at 10 % of duration), `sprite.jpg` (10-column grid of 160×90 frames, one every 5 s) and `sprite.vtt` (`#xywh` cues). `GET /v1/videos/:id` exposes `posterUrl`, `spriteUrl`, `spriteVttUrl`; the test page shows the poster and a hover-scrub preview from the sprite. If thumbnail generation fails, the video still becomes `READY` (dependency ignored on failure) and the failure is visible in `processing_steps`.

## Acceptance criteria
- [ ] `s60` → poster + 12-frame sprite (2 rows) + VTT with 12 cues of 5 s; `m10` → 120 frames; VTT validated by a parser test.
- [ ] Thumbnail child runs concurrently with transcodes (start times overlap in `processing_steps`).
- [ ] Forced thumbnail failure (test flag) → `package` still runs, video `READY`, `poster_key` null, step `FAILED` with code; `renditions` unaffected.
- [ ] Test page displays poster and hover preview.

## Out of scope
Scene-aware poster selection.

## Notes for the implementer
- Concurrency 2 per process; ~60 s lock; a 4K source must be scaled before tiling to keep memory bounded.

## Testing plan
Integration with real FFmpeg; unit for VTT generation.

## Open questions
- Sprite density (PRD OQ-4) — start at 1/5 s, expose as env.

## Definition of Done
- [ ] AC green; screenshot of hover preview in PR.
