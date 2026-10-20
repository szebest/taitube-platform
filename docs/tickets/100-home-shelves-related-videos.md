# 100: Home shelves with reasons, related videos and viewer progress on every card

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 36 - Public video feed · 41 - Channel subscriptions · 46 - Playlists and watch history · 58 - Modern browse layout |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** ready

> **Why.** The home page is shelves with a reason in their heading ("Continue watching", "From your
> subscriptions", "Because you watched Lisbon at night"), cards carry a reason label and a progress bar, and the
> watch page has "More like this" ([docs/design/README.md section 8](../design/README.md#8-surfaces)). Today
> `/v1/feed` is one sorted list with no reasons, `/v1/me/history/:videoId` is one request per card, and nothing
> answers "related to this video". 58 and 59 render fallbacks from the plain feed until this lands, through query
> factories this ticket swaps.

## What to build

Recommendations that can always explain themselves: deterministic heuristics over data the platform already has,
no model, every item tagged with the reason it was picked.

### 1. Home

`GET /v1/home` (anonymous allowed) returns ordered shelves:

| Shelf `kind` | Signed in | Items |
|---|---|---|
| `continue` | yes | partly watched videos, newest first, with progress |
| `subscriptions` | yes | recent public uploads from subscribed channels |
| `because-watched` | yes, one per recent strong watch (up to three) | videos co-watched with, sharing tags with, or from the channel of that video |
| `category` | both | one per category the viewer watches most (signed out: the top categories) |
| `trending` | both | the feed's `trending` ranking |
| `shorts`, `live` | both | added when [102](102-shorts.md) and [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md) provide them |

- Each shelf: `{ kind, subject?: { videoId | channelId | categoryId }, items: VideoSummary[] }`; each item also
  carries `reason: { kind, subjectId? }`. Reasons are data; the web app turns them into copy through
  `@vp/messages`, so the API never sends a sentence.
- Signed-in results are cached per user in Redis for five minutes and dropped on a new watch or subscription.

### 2. Related

`GET /v1/videos/:id/related`: up to 20 public videos ranked by co-watch (viewers who watched both), shared tags,
same channel, same category, with `reason` on each; the current video and the viewer's own uploads excluded.

### 3. Progress on every summary

Every list that returns `VideoSummary` (feed, home, related, search, subscriptions feed, playlists) adds
`viewer: { progressSeconds, watchedAt } | null` for a signed-in caller, from one batched join on history, so a
grid of 24 cards makes one request, not 25.

### 4. The web app

- 58's home loader switches its query factories to `GET /v1/home`; each shelf renders through a smart wrapper
  per `kind`, the reason label from the item's `reason`.
- 59's "More like this" reads `related`.
- `FeedVideoCard` reads progress from the summary instead of a per-card history query.

## Acceptance criteria

- [ ] A signed-in viewer with history sees `continue`, `subscriptions` and at least one `because-watched` shelf,
      each item with a reason; a signed-out visitor sees `category` and `trending`.
- [ ] `related` for a video never returns that video, private or unready videos, or the viewer's own uploads.
- [ ] A feed page of 24 cards shows progress with no request beyond the feed itself.
- [ ] A new watch changes the next `GET /v1/home` within the cache rules.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Learned ranking, A/B testing, "Not interested" feedback (a later ticket).

## Testing plan

- Ranking: fixtures of watches and tags with expected shelves and reasons, as `it.each` tables.
- Routes: anonymous and signed-in home, related exclusions, the progress join on each list.
- Web: home and More like this through `renderRoute` with MSW.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §6.1 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
