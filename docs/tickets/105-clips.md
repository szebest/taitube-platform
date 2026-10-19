# 105: Clips - share a moment of a video as its own link

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 39 - Permissions · 57 - Production video player · 59 - Modern video watch page |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Why.** The watch page's engagement bar has a Clip action
> ([docs/design/apps/web/engagement-bar.md](../design/apps/web/engagement-bar.md)). A clip is a named range of an
> existing video; nothing stores one today.

## What to build

- **No new media**: a clip is a reference, `{ videoId, startMs, endMs, title }`, played from the source video's
  HLS master with the player held to the range, so creating one costs no transcode and no storage.
- Table `clips` in `@vp/db`: `id`, `video_id`, `user_id`, `start_ms`, `end_ms` (5 to 60 seconds long, inside the
  video), `title`, `created_at`; one migration. Rules in `@vp/domain-rules`; creating needs a signed-in viewer and
  a public video, through `@vp/permissions`.
- `POST /v1/videos/:id/clips`, `GET /v1/clips/:id` (anonymous; a clip of a video that turned private returns not
  found), `GET /v1/me/clips`, `DELETE /v1/clips/:id` (its creator).
- **Web**: Clip opens a `Dialog` with a range on the `Slider` primitive over the seek bar's sprite frames, a preview
  loop and a title; saving copies the link `/clip/$clipId`. That route renders the watch page in clip mode: the
  player loops the range, a "Watch the full video" link opens `/watch/$videoId?t=`. The You hub gains a Clips shelf.

## Acceptance criteria

- [ ] A viewer clips 20 seconds of a public video; the link plays exactly that range on loop for anyone, signed in
      or not.
- [ ] A range under 5 or over 60 seconds, or outside the video, is refused in the API and the dialog.
- [ ] A clip of a video made private stops resolving; its creator can delete it.
- [ ] The dialog and clip mode meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Clips of live streams, re-encoded clip files, or clip analytics for creators.

## Testing plan

- Rules: an `it.each` table over ranges.
- Routes: create, read anonymous, the private-video case, delete by its creator.
- Web: the clip dialog and the clip route through `renderRoute`; an e2e flow creating and opening a clip.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
