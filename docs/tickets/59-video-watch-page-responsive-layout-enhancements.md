# 59: Modern video watch page — dynamic 2-column layout, interactive engagement bar & threaded comments UI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#59](https://github.com/szebest/taitube-platform/issues/59) |
| Size | L |
| Blocked by | 57 — Production video player · 58 — Modern browse layout |
| Blocks | 62, 71, 73, 75, 76 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

## What to build

The watch page is the core destination of the application. The original frontend suffered from several awkward UI flaws: comments were placed in a rigid list without collapse controls, the description box had no expandable show-more mechanism, the subscribe button had no active subscribed state, and related videos in the right column lacked layout balance.

This ticket delivers a completely modernized, polished **Watch Page (`/watch/:id`)**:

1. **Fluid Two-Column Responsive Layout**:
   - **Primary Column (Left/Top):** The Vidstack Player (Ticket 55), primary video title, channel identity bar, engagement action bar, expandable description card, and comment section.
   - **Secondary Column (Right/Bottom):** Up Next / Related videos rail with compact horizontal cards and autoplay toggle.
   - **Theater Mode Adaptation:** When theater mode is toggled, player spans 100% width across the top, shifting the two-column layout directly below it.
2. **Interactive Engagement & Channel Bar**:
   - **Creator Channel Pill:** Avatar with verified badge, channel name, subscriber count, and dynamic Subscribe button (states: `Subscribe` -> `Subscribed` with notification bell dropdown).
   - **Segmented Like / Dislike Pill:** Single unified pill button with animated thumb icons, optimistic counter updates, and active glowing states.
   - **Share Modal & Action Buttons:** One-click link copy with toast alert, timestamped URL checkbox (`?t=120`), and Add to Playlist modal.
3. **Expandable Rich Description Card**:
   - Collapsed state showing view count, upload date, and first 3 lines of description.
   - Clickable expanded state supporting clickable timestamps (clicking `02:15` seeks the player to 2m15s) and external links.
4. **Polished Threaded Comments UI**:
   - Sort selector: *"Top comments"* (most likes) vs *"Newest first"*.
   - Pinned comment card highlighted with creator avatar and pin badge.
   - In-place reply input box with collapsible reply threads (`"View 14 replies"`).
   - In-place editing and deletion with creator moderation badges.

## Acceptance criteria

- [ ] Responsive watch layout shifts gracefully between 2-column desktop and single-column mobile viewports.
- [ ] Theater mode expands player across top while keeping description and related rail organized below.
- [ ] Channel subscription button toggles state optimistically with backend synchronization (Ticket 41).
- [ ] Unified like/dislike pill reflects user state with instant optimistic feedback (Ticket 40).
- [ ] Share modal with copy link and timestamp checkbox (`?t=...`).
- [ ] Expandable description box with auto-detected timestamps that seek the video player on click.
- [ ] Threaded comments UI displaying pinned comments at top, reply toggles, and creator badges.
- [ ] Zero layout shift during data loading (matching skeleton cards for right rail and comment stream).

## Out of scope

- Live streaming chat (chat room sidecar).

## Notes for the implementer

- Timestamp parser regex: `/(?:(\d{1,2}):)?(\d{2}):(\d{2})/g` converts timecodes to seconds and attaches `player.seek(seconds)` click handlers.
- Modularize components under `apps/web/src/pages/watch/` with <= 200 lines per file (`WatchLayout`, `EngagementBar`, `DescriptionBox`, `CommentThread`).

## Testing plan

- Interaction test: Click timestamp in description box -> assert video player seeks to target time.
- Subscribe test: Click subscribe -> verify button changes to "Subscribed" and counter increments.
- Comment test: Submit reply -> verify reply renders directly under parent comment thread.

## Definition of Done

- [ ] `pnpm --filter @taitube/web test` passes.
- [ ] Watch page responsive across mobile, tablet, and desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
