# 102: Shorts - vertical videos classified at probe, their own feed and the /shorts player

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 36 - Public video feed · 57 - Production video player · 58 - Modern browse layout · 95 - Design system 2 |
| Blocks | 121, 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** ready

> **Why.** Home has a Shorts shelf, channels a Shorts tab, and 95 ships the `/shorts` shell with
> `ShortsPlayerFrame` ([docs/design/apps/web/shorts-player-frame.md](../design/apps/web/shorts-player-frame.md)).
> The platform has no notion of a Short: the probe stage stores `width`, `height` and `duration_ms`, and nothing
> uses them to tell a Short from any other video.

## What to build

### 1. Classification

- A video is a **Short** when it is portrait (`height > width`) and at most 180 seconds long. The rule is a pure
  function in `@vp/domain-rules` over the probed dimensions and duration, so the worker and a backfill agree.
- Column `format` (`standard` or `short`) on `videos`, written by the probe stage ([06](06-worker-runtime-probe-stage.md))
  through the CAS helper (Rule 6); one migration with a backfill over existing ready videos.
- `VideoSummary` and the video resource gain `format`.

### 2. Feeds

- `GET /v1/feed` gains `format` (default `standard`), so the main grid shows no Shorts and the Shorts shelf asks
  for `short`.
- `GET /v1/shorts`: a keyset feed of public, ready Shorts for the swipe player, ranked like `trending` with a
  freshness boost, never repeating within a session (the cursor carries the seen set).
- 58's channel videos endpoint gains the same `format` filter for the channel's Shorts tab.
- [100](100-home-shelves-related-videos.md)'s home adds its `shorts` shelf from this feed.

### 3. The web player

- `/shorts` and `/shorts/$videoId`: `ShortsPlayerFrame` over `TaitubePlayer` (57) in its vertical layout, swipe,
  wheel and arrow keys to move, the next two Shorts preloaded (posters always, the first segment of the next one),
  the URL following the current Short with `replace`.
- The action column wires 40's reactions, 42's comments (the discussion sheet), 59's share and 73's queue.
- Under the `reduced` motion set each Short starts paused.

### Smart wrappers

Over web's kit: `ShortPosterCard` over `VideoCard`, `ShortsFeedFrame` over `ShortsPlayerFrame` and `ShortsCommentSheet` over `CommentThread` in `features/shorts/components/`, and `ShortsShelf` over `Shelf` in `features/browse/components/`. Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Acceptance criteria

- [ ] A 9:16, 45-second upload becomes a Short; a 16:9 or a 4-minute portrait video does not; the backfill
      classifies existing videos the same way.
- [ ] The main feed returns no Shorts by default; the Shorts shelf and `/v1/shorts` return only Shorts.
- [ ] Swiping through ten Shorts never shows one twice and never waits on a poster.
- [ ] Shorts work by keyboard (arrows, Space, M) and announce the change of Short.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- A Shorts-specific upload flow or editor in the studio; remixing.

## Testing plan

- The rule: an `it.each` table over dimensions and durations.
- The worker: the probe stage writes `format`; the backfill.
- Routes: the feed `format` filter and the Shorts keyset feed.
- Web: `/shorts` through `renderRoute` and an e2e swipe flow.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §6.1 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
