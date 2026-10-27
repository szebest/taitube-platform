# 114: Creator stats on the watch page - the numbers and quick actions for the people who run the channel

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 40 - Video reactions · 41 - Channel subscriptions · 43 - Views buffer and creator analytics · 44 - Creator studio video management · 59 - Modern video watch page · 60 - Creator studio dashboard · 65 - Playback telemetry and retention · 95 - Design system 2 · 98 - Realtime user event stream · 113 - Channel comment moderation · 117 - Channel team roles |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §9.8 Housekeeping and the views flush](../SDD.md#98-housekeeping-job-schedulers) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** A creator who opens their own video sees what every viewer sees. Their numbers are one trip away in the
> studio ([60](60-creator-studio-dashboard-video-management-ui.md)'s analytics), so the question "how is the video I
> just published doing?" costs a context switch, and the first two days, when it matters most, have no hourly data at
> all: [43](43-high-scale-video-views-buffer-reconciler.md) keeps daily buckets and ranges of 7, 30 and 90 days.

> **Builds on, does not redo.** Views, daily watch seconds and average retention are 43's
> `GET /v1/creator/videos/:id/analytics`; the retention curve is 65's `GET /v1/creator/videos/:id/retention`; the
> studio's full pages are 60's. Likes are 40's counters, `comments_count` is 42's. This ticket adds one owner-only
> endpoint that gathers them for the watch page in a single request, the two things nothing records yet (hourly views
> for a video's first 48 hours, and which video a subscriber came from) and the panel.

## What to build

### 1. Who sees it

- A `@vp/permissions` action `read` on a new `VideoStats` subject, with the condition "the caller holds the analytics-read
  ability on the video's channel" from [117](117-channel-team-roles.md)'s matrix: the owner, and members whose role
  carries analytics (manager, editor, analytics viewer). Moderators and everyone else never see it. Nothing in a route,
  service or component compares an owner id (Rule 8).
- The endpoint returns 403 to a signed-in caller who can see the video but lacks the ability, 404 `VIDEO_NOT_FOUND` for a
  video the caller cannot see at all (the convention 43 follows), 401 to a guest. The response carries
  `Cache-Control: private, no-store` and never enters the public video resource, the Redis hot caches or the SSR payload
  of an anonymous render.
- Web asks `useCan('read', 'VideoStats', video)` before it fetches or renders anything, so another viewer's page ships
  no stats code path in its data and no request to the endpoint.

### 2. Data nothing records yet

- **Hourly views for the first 48 hours.** Table `video_views_hourly` (`video_id`, `hour` (UTC, truncated), `views`,
  `watch_seconds`; primary key `(video_id, hour)`). The view buffer's hash field moves from a day to an hour
  (`{videoId}|{YYYY-MM-DDTHH}|views`, `|watch` likewise, the shape 43 chose with one more component); the flush rolls the
  hours up into `video_views_daily` exactly as before and upserts `video_views_hourly` only for hours inside 48 hours of
  the video's `published_at`. The table is therefore at most 48 rows per video and needs no retention job. The flush
  stays one transaction with its batch ledger.
- **Subscribers gained from this video.** `channel_subscriptions.source_video_id` (nullable, foreign key to videos,
  `on delete set null`) and a partial index on it. `POST /v1/channels/:id/subscribe` ([41](41-channel-subscriptions-subscriber-feed.md))
  accepts an optional `fromVideoId`; the service keeps it only when the video belongs to that channel and is public,
  and otherwise stores nothing, without an error. The count is net: an unsubscribe deletes the row, so it leaves the
  number.

### 3. The endpoint

`GET /v1/videos/:id/creator-stats`, in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1. It exists only
because the watch page needs likes, comments, subscribers and both time ranges in one round trip; every number it
returns is computed by the services that already own it:

```ts
{
  videoId, generatedAt,
  lifetime: { views, watchSeconds, likes, comments, subscribersGained },
  last30Days: { views, watchSeconds, averageViewDurationSeconds, daily: [{ date, views }] },
  first48Hours: { hours: [{ hour, views }], windowEndsAt } | null,   // null once the window has closed and no row exists
  retention: { average: number | null, dropOffs: [{ percent, positionSeconds, lostShare }] }
}
```

- `last30Days` is 43's `30d` range (no new range value; "28 days" would need one), and `averageViewDurationSeconds` is
  its watch seconds over its views, from one function in `@vp/domain` that the studio can import.
- `dropOffs` come from 65's curve through a pure `dropOffMoments(curve, durationSeconds)` in `@vp/domain-rules`: the
  three largest drops between consecutive 5 percent points after the first one (the first step is the bounce, reported
  as part of `average`), each with the start of its bucket in seconds and the share of viewers lost there.
- Errors are existing codes where one fits; anything new lands in `@vp/errors` and SDD §6.2 together.

### 4. Live in the first 48 hours

After each flush, for every video still inside its first 48 hours, the flush emits one `video.stats.updated` event on
[98](98-realtime-user-event-stream.md)'s stream to the video's analytics-capable members, carrying the video id only. The
cache handler (98's section 3) invalidates the stats query, so an open panel refetches; no payload, no counts on the
wire, and a flush interval is the freshness bound. After 48 hours no event is emitted and the panel stops saying
"updating live".

### 5. Web: the panel

`CreatorStatsPanel`, in web's kit, in the watch page's description column ([59](59-video-watch-page-responsive-layout-enhancements.md)),
above the description and collapsed to its headline row on compact screens:

- a header with a lock `Icon` and "Only you and your team see this", the "Updating live" indicator while the window is
  open (a dot that stops under reduced motion), and a collapse control;
- `StatCard`s for views, watch time, average view duration, likes, comments and subscribers gained, each with the
  range's number (the cards and the sparkline come from [docs/design/apps/studio/stat-card.md](../design/apps/studio/stat-card.md));
- a `SegmentedControl` between "First 48 hours" (hourly bars) and "Last 30 days" (daily), drawn with the kit's sparkline
  and the `dataviz` palette ([docs/design/apps/studio/charts.md](../design/apps/studio/charts.md)); the 48-hour option is
  absent once the window has no data;
- the retention summary: the average, and the drop-off moments as buttons ("0:42, 18% leave here"); a button seeks the
  player to that timestamp through the `TaitubePlayer` port ([57](57-production-video-player-hls-streaming-controls.md))
  and scrolls the stage into view;
- "Open full analytics" as a link to the studio's `/videos/$videoId/analytics`, on the studio origin web already knows
  for its "Open in Studio" button;
- quick actions, each a `Button` rendered through `useCan` on its own ability, so an analytics-only member sees the
  numbers and no actions:
  - **Edit title**: the title edits in place, `Enter` saves through 44's `PATCH` with the video's `version`, `Esc`
    cancels, a version conflict shows a `Callout` with Reload;
  - **Thumbnail**: a `Popover` with the generated frames and the choice 60's editor already offers, through the same
    request; no new endpoint;
  - **Comments on or off**: a `Switch` over 113's `commentsEnabled`;
  - **Pin a comment**: a `Popover` listing the video's most-liked unpinned comments from the thread's query, each with
    Pin, and Unpin for the pinned one, over 42's endpoints and 113's roles.
- Loading is a `Skeleton` and streams after the main content, so the panel never delays the player or LCP; a failure
  renders `SectionError` with a retry and the rest of the page is unaffected.
- `@vp/intl` formats every number, duration and date and `@vp/messages` holds every string (85).
- `StatCard` and the sparkline move from the studio's kit to `@vp/components` in this PR, because web now renders them
  ([the both-apps rule](../design/components/README.md#the-both-apps-today-rule)); the studio's imports follow. New
  kit part: `RetentionStrip` (web kit), a segmented bar of the retention curve with a marker `Button` per drop-off,
  specified under `docs/design/apps/web/`.

## Delivery

One stack of three slices:

1. Data and the flush: the hourly table and the hour-granular buffer field, `source_video_id` and the optional
   `fromVideoId`, `video.stats.updated`.
2. The permission rule, `dropOffMoments`, the endpoint, its contract and SDD.
3. The panel, `RetentionStrip`, the kit move and the quick actions.

## Acceptance criteria

- [ ] The owner opens their video and sees views, watch time, average view duration, likes, comments and subscribers
      gained, matching the studio's analytics for the same video and range.
- [ ] Another signed-in user, a guest and a moderator get 403, 403 and 403 (404 for a private video) from the endpoint and
      render no stats UI, no request and no stats data in the server render.
- [ ] An analytics-viewer member sees the panel and no quick actions; an editor sees the title and thumbnail actions; a
      moderator sees none of it.
- [ ] A subscribe from the watch page of the channel's own video increments `subscribersGained` for that video and an
      unsubscribe decrements it; a forged `fromVideoId` from another channel stores nothing.
- [ ] A video in its first 48 hours shows hourly bars; a view counted by the buffer appears in the open panel within one
      flush interval with no reload; after 48 hours the option and the live indicator are gone.
- [ ] Each drop-off button seeks the player to its timestamp; a video with no retention data shows no drop-offs and no
      error.
- [ ] Editing the title in place saves with the version, and a stale version shows the conflict `Callout`.
- [ ] Toggling comments and pinning a comment from the panel match 113's and 42's results on the thread.
- [ ] The flush still applies a batch once, with a spec over the hour field and the rollup into the daily table.
- [ ] The panel meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Traffic sources: the playback beacon ([65](65-first-party-video-playback-telemetry-analytics-beacon.md)) carries no
  referrer by design, so there is no data to show; a later ticket decides whether to record one.
- Impressions and click-through, demographics, revenue and real-time numbers beyond the 48-hour window.
- A custom thumbnail upload (60's editor owns it).
- Stats for Shorts and clips beyond what their video rows already carry.

## Testing plan

- Domain: an `it.each` table over `dropOffMoments` (flat, steep, single-point and empty curves) and over the average view
  duration.
- Flush: the buffer's hour field, the daily rollup, the 48-hour cut-off and replay of a batch.
- Routes: the 401, 403 and 404 matrix across roles, `Cache-Control`, and a spec that the public video resource and the
  hot caches never contain a stats field.
- Web: `renderRoute` specs for the panel as owner, as an analytics member and as a stranger (no request), the range
  switch, a drop-off seek, each quick action and the live refetch from a simulated event.
- E2E: publish, watch as a second account, watch as the owner.

## Open questions

- Decided: the audience is whoever holds the analytics-read ability from 117's matrix on the channel (owner, manager,
  editor, analytics viewer), not channel moderators, who have no business with performance numbers; "owner only" in
  the original ask widens by exactly that role set once teams exist.
- Decided: the panel shows the last 30 days, not 28, so it reuses 43's range instead of adding one.
- Decided: traffic sources are dropped, not approximated, because nothing records a source and recording one is a
  privacy decision of its own.
- Decided: the live view is an event that invalidates a query, bounded by the flush interval, not a second stream of
  counts.
- Decided: hourly rows are kept for a video's first 48 hours only, so the table is bounded without a retention job.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5 (the new table and column), §6.1, §6.2 and the views-flush section updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
