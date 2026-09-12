# 73: Frontend YouTube-grade playlist & watch history library — watch history feed, playlist manager & player queue tray

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 46 — YouTube-grade playlists · 57 — Production video player · 59 — Modern video watch page · 69 — Frontend URL-driven state |
| Blocks | 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

Playlists and watch history are the two pillars of personal viewing libraries, binge-watching, and user retention. Viewers expect to resume watching videos exactly where they stopped, review past watched videos, clear history, and organize playlists.

This ticket delivers the complete **Frontend YouTube-Grade Playlist & Watch History System**:

1. **Watch History Page & Resume Scrub Bar (`/feed/history`)**:
   - Dedicated Watch History view listing previously watched videos grouped by time ("Today", "Yesterday", "This week"):
     - Shows red/crimson progress bar on thumbnail bottom indicating resume timestamp (e.g. `12:45 / 18:20`).
     - Clicking a history card opens `/watch?v=...&t={progressSeconds}`, instantly resuming playback where the user left off.
     - Per-item removal button ("X" to delete from history via `DELETE /v1/me/history/:videoId`).
     - Top history controls: "Clear all watch history" (`?modal=confirm-clear-history`), "Pause watch history" toggle, and search filter within history.

2. **"Save to Playlist" Modal (`?modal=save-to-playlist&videoId=...`)**:
   - Deep-linked URL modal integrated with `useUrlModal` (Ticket 69) and Radix Dialog.
   - Accessible from any video card (3-dot menu -> "Save to Playlist") or Watch Page action bar ("Save" button).
   - Fetches `GET /v1/me/playlists?videoId=:id` displaying the user's personal playlists:
     - **"Watch Later" (Clock icon):** Always pinned at the top.
     - **Custom Playlists:** Displays title, video count, and visibility badge (Lock for Private, Globe for Public, Link for Unlisted).
     - **Interactive Checkbox:** Toggling a checkbox immediately fires an optimistic mutation (`POST /v1/playlists/:id/items` or `DELETE /v1/playlists/:id/items/:videoId`), updating the checkbox instantly with cache rollback on error.
   - **Inline "+ Create new playlist" Accordion:**
     - Expands inline without closing the modal.
     - Fields: Playlist Title (required, 1–100 chars), Privacy dropdown (Public, Unlisted, Private).
     - Submitting creates the playlist, immediately inserts the active video, updates the checklist, and shows a Sonner confirmation toast.

3. **Playlist Detail / Management View (`/playlist?list=PL...`)**:
   - Dedicated page matching YouTube's playlist layout:
     - **Left Column (Sticky Hero Card):**
       - Stacked thumbnail preview poster with ambient blur glow backdrop.
       - Playlist Title, Description, and Creator channel badge (avatar, display name, handle).
       - Metadata chips: total video count, total duration (e.g. `24 videos • 1 hr 45 min`), visibility pill.
       - Action buttons: "Play All" (starts playback at index 0), "Shuffle", and "Share" (`?modal=share`).
       - **Owner Controls:** Edit title and description inline, change privacy dropdown, or Delete playlist (`?modal=confirm-delete`).
     - **Right Column (Ordered Video List):**
       - Numbered video items (`1`, `2`, `3`...).
       - Drag-and-drop reordering handles (powered by `@dnd-kit/core` or HTML5 drag events) allowing users to drag items into any position with optimistic UI and batched synchronization to `PUT /v1/playlists/:id/reorder`.
       - Per-item 3-dot dropdown: "Remove from playlist", "Move to top", "Move to bottom".

4. **Watch Page Playlist Context & Queued Player Tray (`/watch?v=...&list=PL...&index=...`)**:
   - When viewing a video with `&list=PL...`:
     - Renders a collapsible **Playlist Queue Tray** adjacent to `<TaitubePlayer />` (or docked above comments in mobile / theater mode).
     - **Tray Header:** Displays playlist title, creator name, track counter (`3 / 24`), Shuffle toggle, and Loop mode toggle (Off / Loop Playlist / Loop Single).
     - **Auto-Scroll & Active Glow:** The tray automatically scrolls to center the currently playing video, highlighted with an obsidian neon border.
     - **Continuous Autoplay:** When `<TaitubePlayer />` emits the `ended` event, the player automatically navigates to `index + 1` without requiring viewer interaction.
     - **Player Playlist Controls:** Previous / Next track buttons inside `<TaitubePlayer />` become active and advance or rewind through the playlist queue.
     - Preserves playlist parameters in URL (`?v=...&list=PL...&index=...`) for sharing exact queue playback states.

## Acceptance criteria

- [ ] Watch History page implemented at `/feed/history` displaying paginated past watched videos with red resume progress indicators.
- [ ] Resuming video from history passes `?t={seconds}` and restores player playback position.
- [ ] Single item deletion and "Clear all history" modal trigger backend synchronization with optimistic removal.
- [ ] "Save to Playlist" modal implemented in `apps/web/src/components/playlists/save-to-playlist-modal.tsx` bound to `?modal=save-to-playlist&videoId=...`.
- [ ] Modal lists user's playlists with checked state indicating video presence, with "Watch Later" pinned to top.
- [ ] Toggling playlist checkbox triggers optimistic mutation to add/remove video with toast notification.
- [ ] Inline "+ Create new playlist" form successfully creates playlist and adds video.
- [ ] Playlist detail page route `/playlist` implemented in `apps/web/src/routes/playlist.tsx`:
  - Left hero poster card with stacked thumbnails, title, duration, and "Play All" CTA.
  - Right video list with drag-and-drop reordering handle updating `PUT /v1/playlists/:id/reorder`.
  - Item menu supports "Remove from playlist" and "Move to top/bottom".
- [ ] Watch Page playlist queue tray implemented in `apps/web/src/components/player/playlist-queue-tray.tsx`:
  - Displays list of upcoming videos with active video highlighted.
  - Automatically advances to `index + 1` on video `ended` event.
  - Previous / Next buttons in `<TaitubePlayer />` navigate queue.
  - Loop and shuffle modes operational.
- [ ] Vitest integration tests in `apps/web/src/__tests__/playlists.integration.test.tsx` verifying history resume, save modal mutations, reordering drag events, and watch queue autoplay transitions.

## Out of scope

- Collaborative multi-user playlist editing.
- Automatic smart recommendations appended to user playlists.

## Notes for the implementer

- **Drag-and-Drop Performance:** Use `@dnd-kit/sortable` or lightweight pointer drag handles. Update local list state instantly on `onDragEnd` before awaiting the server `PUT /v1/playlists/:id/reorder` response.
- **Autoplay Guard:** If the user has explicitly paused video or disabled browser autoplay, queue advance pauses on the first frame of the next video.
- **File Length Discipline:** Keep each component file <= 250 lines.

## Testing plan

- Modal test: Render modal with MSW; toggle checkbox; verify mutation sent and optimistic checkmark toggles.
- Queue test: Simulate video end event; verify router advances search param `index` from 0 to 1 and loads next video.
- Reorder test: Simulate drag from position 3 to 1; verify `PUT /v1/playlists/:id/reorder` payload.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test` (or `pnpm test`).
- [ ] Complete YouTube playlist flow verified in browser.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
