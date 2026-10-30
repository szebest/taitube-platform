# 96: Channel featured videos - creators pin the Start here shelf

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 58 - Modern browse layout · 72 - Settings and customisation · 95 - Design system 2 |
| Blocks | 121 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** ready

> **Why.** The channel page opens on a Start here shelf ([docs/design/README.md](../design/README.md), signature
> moves): the videos a newcomer should watch first. Only the creator knows which those are. Until this ticket,
> [58](58-modern-browse-layout-microinteractions-motion.md) fills the shelf with the channel's most-viewed
> uploads, through one query factory, so this ticket changes its source and nothing else on the page.

## What to build

A creator picks and orders up to six of their videos in Studio; the channel page shows them as Start here.
A channel that pins none keeps the most-watched fallback, decided once, on the server.

### 1. Data

- Table `channel_featured_videos` in `@vp/db`: `channel_id`, `video_id`, `position` (0 to 5), `created_at`;
  primary key `(channel_id, video_id)`, unique `(channel_id, position)`, both foreign keys `on delete cascade`.
  One migration.
- A repository interface in `@vp/core/repositories` with its postgres and in-memory implementations, each in its
  own file (Rule 5): `listForChannel(channelId)` and `replace(channelId, videoIds)` in one transaction.

### 2. Rules

In `@vp/domain-rules`, pure and returning `Result` (Rule 14), over the channel and the candidate videos:

- at most six videos, no duplicates;
- every video belongs to the channel's owner, is `READY` and `PUBLIC`.

Each failure is an existing `ErrorCode` where one fits, or a new one in `@vp/errors` (SDD §6.2 updated in the
same PR). The service composes them; the route unwraps through `sendResult`.

### 3. API

| Endpoint | Who | What |
|---|---|---|
| `GET /v1/channels/:idOrHandle/featured` | anonymous | `{ source: 'pinned' \| 'popular', items: VideoSummary[] }`: the pinned videos still `READY` and `PUBLIC`, in order; when none qualify, the six most-viewed public uploads with `source: 'popular'` |
| `PUT /v1/me/channel/featured` | the channel owner | body `{ videoIds: string[] }` in display order; replaces the set; an empty list clears it |

- Both in `@vp/api-contracts` with their schemas, in the committed OpenAPI document (`pnpm gen:contracts`) and in
  SDD §6.1.
- The owner check is a `@vp/permissions` rule, the `pin` action on `Video` with the channel's own videos as its condition,
  never a hand check (Rule 8); Start here is an ordered set of up to six pins stored by `position`, the cap and vocabulary
  of [113](113-channel-comment-moderation.md)'s pinning table, and [117](117-channel-team-roles.md) widens who holds it.
- A video that turns private, unlisted or deleted drops out of `GET` on the next read; the row stays until the
  creator saves again or the video is purged (the cascade).
- If channel reads are cached, the `PUT` invalidates this channel's featured entry.

### 4. Studio: the Start here section

A section on the studio's `/customization` page ([72](72-frontend-settings-customization-system.md)):

- the current pins as rows on the `SortableList` primitive (drag and keyboard reordering), and remove;
- "Add videos": a `Command` picker over the creator's public, ready videos, disabled at six;
- a live preview of the shelf with `StartHereShelf`, and the note "Viewers see your most-watched videos until
  you pin some" while the list is empty;
- save through an optimistic mutation over `PUT /v1/me/channel/featured`, a toast on success, rollback and the
  presented error on failure.

### 5. Web: the shelf switches source

- `channelStartHereQueryOptions` (58) reads `GET /v1/channels/:idOrHandle/featured`; the page passes
  `source` to `StartHereShelf`, which titles the shelf "Start here" for `pinned` and "Most watched" for
  `popular`.
- No other change to the channel page.

## Acceptance criteria

- [ ] A creator pins three videos in Studio, reorders them by keyboard, saves, and the channel page shows them
      in that order under "Start here" on the server render.
- [ ] A channel with no pins shows its six most-viewed public uploads under "Most watched".
- [ ] Pinning a seventh video, a private or processing video, or another creator's video is refused with the
      matching error code, in the API and in the picker.
- [ ] A pinned video made private disappears from the shelf on the next read without a save.
- [ ] Clearing the list returns the shelf to "Most watched".
- [ ] `PUT` by anyone but the owner is a 403 through the permissions rule; `privilege-escalation.test.ts`
      gains the row.
- [ ] The Studio section and the shelf meet the polish bar
      ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Pinning playlists or Shorts to the shelf.
- Per-viewer ordering or recommendations inside the shelf.

## Notes for the implementer

- Follow the repository, rule and service shapes of the playlist reorder in
  [46](46-youtube-playlists-watch-history-engine.md): it is the closest existing ordered set of videos.
- The fallback is server-side on purpose: the web app renders `source` and never decides it, so the rule for
  "most watched" lives in one place.

## Testing plan

- Domain rules: one `it.each` table over the failure cases and the valid set.
- Repositories: the shared contract suite over the postgres and in-memory implementations.
- Routes: contract tests for both endpoints, including the fallback and the dropped private video.
- Studio: jsdom specs for the section (reorder by keyboard, the six-video limit, rollback on error).
- E2E: pin in the studio app, read the channel page in the web app.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
