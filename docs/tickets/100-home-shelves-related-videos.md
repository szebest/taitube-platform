# 100: Home shelves with reasons, related videos and viewer progress on every card

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 36 - Public video feed · 41 - Channel subscriptions · 46 - Playlists and watch history · 58 - Modern browse layout |
| Blocks | 124, 126 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

> **Why.** The home page is shelves with a reason in their heading ("Continue watching", "From your
> subscriptions", "Because you watched Lisbon at night"), cards carry a reason label and a progress bar, and the
> watch page has "More like this" ([docs/design/README.md section 8](../design/README.md#8-surfaces)). Today
> `/v1/feed` is one sorted list with no reasons, `/v1/me/history/:videoId` is one request per card, and nothing
> answers "related to this video".

> **Web scope.** [95](95-design-system-2.md)'s `Shelf`, `VideoCard` and `ChipBar` land in its components work (r2),
> after this ticket. The web side here is the minimum: the home route, a shelf and the existing card in
> `apps/client/web/src/features/`, on `@vp/ui` primitives. r2 lifts the shelf and the card into the kit and
> [58](58-modern-browse-layout-microinteractions-motion.md) g to j build the final home on them, keeping
> `homeQueryOptions` and the reason copy. The watch page's "More like this" is on the page that exists, until
> [59](59-video-watch-page-responsive-layout-enhancements.md) replaces it.

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

- `/` loads `GET /v1/home` through `homeQueryOptions` and renders one `HomeShelf` per shelf, its heading from the
  shelf's `kind` and `subject` through `@vp/messages`. It replaces the legacy all-videos page, its category list and
  the drag-scroll menu behind it; category browsing returns with 58's chip bar.
- `VideoCard` takes the item's `reason`, shown as a line from `home.reason`, and draws a progress bar from the
  summary's `viewer`, with no per-card history query.
- The watch page lists `GET /v1/videos/:id/related` under "More like this" through `relatedQueryOptions`, a plain
  `useQuery` next to the page's primary data.

### 5. Decided

- `viewer` is optional on `VideoSummary`: absent for an anonymous caller, `null` for a signed-in caller who never
  watched the video. A failed progress read leaves the cards without it instead of failing the page.
- A feed page for a signed-in caller is `Cache-Control: private`; every feed answer is `Vary: Authorization`.
  Search keeps one cached page for everyone and adds `viewer` after the cache read.
- `subject` is a tagged `{ kind, id, name }`, so "Because you watched Lisbon at night" needs no second lookup.
- A strong watch is one watched to at least half. Categories come from the viewer's recent history, topped up from
  the categories on the trending page, which is also all a signed-out visitor gets. The tuning values live in
  `packages/universal/domain/src/home.ts` and `related.ts`.
- A signed-out home is cached too, under `taitube:home:anonymous`, for the same five minutes.
- Related is ranked by the signals in order (co-watch, tags, channel, category), then views; there is no weighted
  score, so the reason of a video is always the signal that placed it.

## Acceptance criteria

- [x] A signed-in viewer with history sees `continue`, `subscriptions` and at least one `because-watched` shelf,
      each item with a reason; a signed-out visitor sees `category` and `trending`.
- [x] `related` for a video never returns that video, private or unready videos, or the viewer's own uploads.
- [x] A feed page of 24 cards shows progress with no request beyond the feed itself.
- [x] A new watch changes the next `GET /v1/home` within the cache rules.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
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

- [x] All acceptance criteria proved with command output in the PR.
- [x] SDD §6.1 updated; the OpenAPI document regenerated.
- [x] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
