# 104: Channel page data - public playlists, About links and channel stats

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | S |
| Blocked by | 38 - User identity · 46 - Playlists and watch history |
| Blocks | 72 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

> **Why.** The channel page has a Playlists tab and an About tab with the creator's links and the channel's
> numbers ([docs/design/apps/web/channel-header.md](../design/apps/web/channel-header.md)), and 72's channel form
> edits social links. `ChannelSchema` has no links and no counts, and no endpoint lists a channel's public
> playlists.

## What to build

- **Links**: column `links` on channels (up to five `{ label, url }`, `https` only, validated in `@vp/validation`);
  `PATCH /v1/me/channel` accepts them; the channel resource returns them.
- **Stats** on the channel resource: `videoCount` (public, ready, Shorts counted apart once [102](102-shorts.md)
  lands) and `totalViews`, derived in the channel read over the public feed's own scope and served by a partial
  index on the owner's counted videos, so publish and the view buffer's flush need no second state.
- **Public playlists**: `GET /v1/channels/:idOrHandle/playlists`, keyset, the channel's public playlists with
  their item count and the first thumbnails, from [46](46-youtube-playlists-watch-history-engine.md)'s tables.
- 58's channel page reads them for the Playlists and About tabs; 72's channel form writes the links.

## Acceptance criteria

- [ ] A creator saves three links; the About tab shows them; a non-https link or a sixth link is refused.
- [ ] The channel resource's `videoCount` and `totalViews` match the public videos and their views, and update
      on publish and on the view buffer's flush.
- [ ] The Playlists tab lists only public playlists, with counts and thumbnails, paged.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Community posts (the Community tab stays hidden until its own ticket).

## Testing plan

- Validation: an `it.each` table over links.
- Routes: the channel resource's new fields, the playlists endpoint's visibility filter and paging.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
