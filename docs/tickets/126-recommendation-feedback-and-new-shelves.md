# 126: Recommendation feedback - "Not interested", hidden channels, a "Because you searched" shelf and a rising-creators shelf

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 58 - Modern browse layout · 65 - Playback telemetry · 72 - Settings · 95 - Design system 2 · 100 - Home shelves with reasons · 125 - Viewer activity |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** [100](100-home-shelves-related-videos.md) shipped deterministic shelves where every item carries the reason it was
> picked, and left "Not interested" feedback to "a later ticket", which is this one. Today a viewer cannot say "not this" or
> "never this channel": the same trending, category and related videos come back on every visit. Two sources of reasons are
> also missing and the data is already there: what the viewer searched for a moment ago
> ([125](125-viewer-activity-search-history-likes-comments.md)) and small channels whose new videos people actually finish
> ([65](65-first-party-video-playback-telemetry-analytics-beacon.md)'s retention steps).

> **What this ticket does not build, and why.** The first draft was a learned-affinity engine. It contradicted 100's
> decision ("no weighted score, so the reason of a video is always the signal that placed it") and invented machinery for
> data the platform does not have:
>
> - `user_interest_profiles` with per-tag weights, 14-day decay and a background aggregation job; the `final_score` formula
>   and the 60/15/15/10 quotas. Weights nobody can explain to the viewer are what 100 rejected; nothing here needs them.
> - `GET /v1/home/personalized`: `GET /v1/home` already is the personalized home and gains shelves.
> - XFetch in `@vp/concurrency`: XFetch lives in `redis-reaction-cache.adapter.ts` (ADR-22), and 100's home page cache
>   (five minutes per viewer, dropped on a watch or subscription) already covers this; it also drops on feedback below.
> - Topic pills (`/v1/me/recommendations/topics`, "New to you", "Deep Dive"): 58's category `ChipBar` is the topic control.
> - A "Why was this recommended?" popover with statistics ("82% of viewers..."): the reason line on every card is that
>   explanation, and no such statistic is computed.
> - A skip penalty for videos left in 15 seconds: 100's "strong watch" (half the video) already keeps bounces out of
>   `because-watched`.
> - "Up Next": the watch page has 100's "More like this" and 73's queue, no separate Up Next feed.

## What to build

### 1. Feedback

- Table `recommendation_feedback` in `@vp/db` (own file): `id` (UUIDv7), `user_id` (cascade), `kind` (`not_interested` |
  `hide_channel`, a literal union in `@vp/domain`), `video_id` (nullable, FK, cascade), `channel_id` (nullable, FK,
  cascade), `created_at`; a check that exactly the column of its `kind` is set, partial unique indexes on
  `(user_id, video_id)` and `(user_id, channel_id)`, and `(user_id, created_at desc, id desc)`. A user keeps at most 1000
  rows: a write that exceeds it deletes the oldest in the same statement.
- Port `RecommendationFeedbackRepositoryPort` in `@vp/core/repositories`, postgres and in-memory, each in its own file, one
  shared contract spec. `hiddenOf(userId)` returns the two id sets in one read.
- Endpoints, in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1, signed-in:
  - `PUT /v1/me/recommendation-feedback`, a tagged body `{ kind: 'not_interested', videoId }` or
    `{ kind: 'hide_channel', channelId }`; idempotent (the same target returns its existing row); `404 VIDEO_NOT_FOUND` for
    a video the caller may not read (`decideVideoRead`), `404 CHANNEL_NOT_FOUND` for an unknown channel.
  - `DELETE /v1/me/recommendation-feedback/:id` (204; 404 when the row is not the caller's): the Undo.
  - `GET /v1/me/recommendation-feedback` (keyset, optional `kind`): rows with the video or channel summary, for the
    settings list.
- Feedback is an explicit act, so it is stored even while `historyPaused` is set (that switch governs what the platform
  records on its own).
- Every write drops the viewer's cached home page (`HomeService.forget`, as 46's history writes do), so the removal shows at
  once.

### 2. Where feedback applies

- A pure `applyFeedback(shelves, hidden)` in `@vp/domain` removes items whose video id or channel id is hidden and drops a
  shelf left empty. `HomeService` calls it on every shelf except `continue` and `subscriptions` (a viewer's own watching and
  subscribing outrank "don't recommend"); `RelatedService` calls it on "More like this".
- Never filtered: `/v1/feed`, search, channel pages, playlists, the subscriptions feed and [122](122-linked-content-graph.md)'s
  creator-curated links. Those are navigation or the creator's choice, not recommendation.
- A shelf that loses items shows fewer than 12 and is not back-filled; filtering happens after the viewer-independent reads,
  so it adds no query beyond `hiddenOf`.

### 3. Two new shelves in `GET /v1/home`

Both are deterministic and carry their reason; the contract gains shelf kinds `because-searched` and `rising`, reason kinds
`searched` and `rising`, and subject kind `query`. Tuning lives in `packages/universal/domain/src/home.ts` next to 100's.

- **`because-searched`** (signed in): the viewer's most recent `search_history` row from the last 48 hours becomes one
  shelf, `subject: { kind: 'query', id: <row id>, name: <query text> }`, filled by `SearchService.search` for `type=video`
  (47's ranking, its shared page cache), minus videos the viewer already watched, so search ranking stays 47's. Each item's
  reason is `{ kind: 'searched', subjectId: <row id> }`. A new search shows on the next build, at most five minutes later
  (100's cache); searches do not drop the cached page.
- **`rising`** (everyone): public ready videos published in the last 14 days by channels with at most 1000 subscribers
  (`channels.subscriber_count`), with at least 20 retention sessions (`video_retention_milestones` at 0 percent), ordered by
  completion ratio (viewers at the 90 percent step over viewers at 0 percent), ties by newest; one video per channel; the
  viewer's own uploads and watched videos excluded. Reason `{ kind: 'rising', subjectId: <channelId> }`. One repository
  read, `RisingVideosRepositoryPort.find`, with the same read scope as the public feed; the ratio and the eligibility
  constants are `@vp/domain` functions so both runtimes test them.

### 4. Web

- `VideoCard`'s three-dot menu ([58](58-modern-browse-layout-microinteractions-motion.md), the kit's `DropdownMenu`) gains
  "Not interested" and "Don't recommend this channel" on cards that carry a `reason` (home shelves and More like this). The
  card leaves the shelf at once, and a `Toast` offers Undo, which calls the `DELETE`; a failed `PUT` restores the card.
- Reason copy for `searched` and `rising` and the two shelf headings ("Because you searched for X", "Rising creators") in
  `@vp/messages`; the API still sends no sentence.
- [72](72-frontend-settings-customization-system.md)'s privacy section gains a "Hidden channels and videos" list over
  `GET /v1/me/recommendation-feedback`, each row with Undo.

## Delivery

One stack of three slices:

1. Feedback: the table, port and repositories, the three endpoints, `applyFeedback`, the home and related filtering, the
   cache drop, contracts and SDD.
2. The shelves: the contract kinds, `because-searched`, `rising` and its repository, the tuning constants.
3. Web: the card menu actions and Undo, the shelf headings and reasons, the settings list.

Slice 1 has no blocker beyond 100; slice 2 waits for 125; slice 3 for 58, 72 and 95.

## Acceptance criteria

- [ ] "Not interested" on a video removes it from the next `GET /v1/home` and from "More like this", and the same video
      still appears in search, the feed and its channel page.
- [ ] "Don't recommend this channel" removes every video of that channel from home shelves (except `continue` and
      `subscriptions`) and from related; undoing it brings them back on the next build.
- [ ] A feedback write is idempotent, is refused with 404 for a video the caller cannot read, is stored while history is
      paused, and the 1001st row removes the oldest.
- [ ] A signed-in viewer who searched an hour ago sees a `because-searched` shelf whose items match that query, whose
      heading names it, and which lists no watched video; one who searched three days ago and a guest get none.
- [ ] `rising` lists only videos from channels with at most 1000 subscribers and at least 20 sessions, one per channel,
      best completion first, never the viewer's own; a guest sees it.
- [ ] Every item of both shelves carries its reason, and the web shows it as copy from `@vp/messages`.
- [ ] The card menu removes a card at once, Undo restores it and a failed request rolls it back; the settings list shows and
      undoes each row.
- [ ] `privilege-escalation.test.ts` gains rows: another user's feedback id on `DELETE` and a guest on every route.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Learned or weighted ranking, interest profiles, decay, quotas, A/B testing and anything that needs a model.
- Topic pills and "New to you" modes; a statistics popover; skip penalties.
- Feedback on search results, comments or Shorts and clips ([102](102-shorts.md), [105](105-clips.md)).
- Subscribed channels inside "Don't recommend": the subscriptions shelf stays, and unsubscribing is the control for that.

## Testing plan

- Domain: `it.each` tables over `applyFeedback` (hidden video, hidden channel, an emptied shelf, the exempt shelf kinds) and
  over the rising eligibility and ordering (subscriber cap, session floor, ties, one per channel).
- Repositories: one contract spec for feedback (idempotent put, the check constraint, the 1000 cap, scoped delete) and one
  for `rising` over fixed retention rows, in both implementations.
- Services and routes: home and related for a viewer with and without feedback, the search shelf at the 48-hour edge, the
  cache drop after a write, the 401, 403 and 404 matrix with `app.inject()`.
- Web: through `renderRoute` with MSW, the menu actions, Undo, the rollback and the settings list.

## Open questions

- Decided: feedback filters recommendations and nothing else, so a viewer who hid a channel can still search for it.
- Decided: a viewer's own watching and subscriptions outrank feedback, because `continue` and `subscriptions` are what they
  explicitly chose.
- Decided: filtering is after the viewer-independent reads, so shelves may be short; back-filling would need a second query
  per shelf and the shelves are already five minutes cached.
- Decided: the rising threshold counts subscribers and sessions, constants a platform with different scale tunes in one file.
- Decided: a search shelf appears within the home cache window, not instantly, because dropping the page on every search
  would defeat the cache for the most frequent action.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5 (the table), §6.1 and the recommendations section updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
