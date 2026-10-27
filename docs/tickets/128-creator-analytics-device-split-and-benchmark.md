# 128: Creator analytics that hold up - views the player really sends, a device split and a first-week benchmark

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 43 - Views buffer and creator analytics · 60 - Creator studio dashboard · 65 - Playback telemetry · 95 - Design system 2 · 114 - Creator stats on the watch page |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §9.8 Housekeeping and the views flush](../SDD.md#98-housekeeping-job-schedulers) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** The studio's numbers rest on [43](43-high-scale-video-views-buffer-reconciler.md)'s view buffer, and nothing in
> the apps feeds it: no client calls `POST /v1/videos/:id/views` (the web player sends only 65's playback beacon, which
> feeds retention and Prometheus), so `views_count`, `video_views_daily` and everything built on them, including
> [114](114-creator-stats-on-the-watch-page.md)'s panel, [60](60-creator-studio-dashboard-video-management-ui.md)'s charts and
> [118](118-creator-data-portability-and-api.md)'s exports, stay empty outside tests and load runs. Two more defects sit under
> the same data: the views route has no `text/plain` parser, so `navigator.sendBeacon` would be refused with 415, and no rate
> limit; and the buffer counts watch seconds only on a viewer's first beacon of the day, so watch time is the length of the
> first beacon, not the time watched. Once those are fixed, two questions a creator asks have an answer in data the platform
> already holds without recording anything new about a person: which devices watch, and whether a new video is doing better
> or worse than the channel's usual first week.

> **Builds on, does not redo.** Daily views and the range endpoint are 43's; the 5 percent retention curve and its endpoint
> are 65's; the first-48-hours table, `dropOffMoments` and the views-flush hour field are 114's; the studio shell, charting
> library and `ChartFrame` are 60's and [95](95-design-system-2.md)'s; exports are 118's; the analytics read rule is
> `decideVideoAnalyticsRead` (and 117's matrix once it lands, with no change here).

> **What this ticket does not build, and why.** The first draft was a demographics and "audience intelligence" suite. Cut:
>
> - Country and geography: no IP is stored (65), the local stack has no resolver, and `cf-ipcountry` exists only behind
>   Cloudflare, so locally every row would read "unknown". Recording a country is a privacy decision no ticket has made; see
>   *Open questions*.
> - Traffic sources: 65 records no referrer by design, so there is nothing to show (114 reached the same conclusion).
> - OS and browser breakdowns: user-agent strings are fingerprint material for a chart nobody acts on. Only a three-value
>   device class is recorded, and never the user agent.
> - New versus returning viewers and subscriber cohorts: they need a persistent per-viewer record across days, which is a
>   dossier. 43 dedupes per day and 65's session id rotates on every load; both stay that way. Subscribers gained per video is
>   114's.
> - A second-by-second retention heatmap with "scrubbed backward" spikes: the beacon reports a 30-second heartbeat and a
>   position, not intervals, and the curve is 5 percent steps; per-second data cannot be derived from it. Drop-off moments are
>   114's `dropOffMoments`, over the same curve.
> - A video-versus-"discovery viewers from 126" stacked area: no source attribution exists.
> - `video_retention_spikes` and a slope-detection job, Redis caching "under 50 ms" and a 100 percent coverage line: the reads
>   below are primary-key range scans over a few hundred rows, and test coverage is Rule 12's.

## What to build

### 1. The data becomes true

- **The sender.** The web player's playback tracker ([65](65-first-party-video-playback-telemetry-analytics-beacon.md),
  `features/player/telemetry/`) sends 43's view beacon once per playback session, the first time the session's watched time
  reaches the minimum the server enforces. That minimum becomes one `@vp/domain` constant (`VIEW_MIN_WATCH_SECONDS`) that
  `tuning.ts` and the client both read. The body is the existing `{ sessionId, watchSeconds, videoDuration }` plus
  `device`; `sessionId` is the tracker's existing `sessionUuid`.
- **The route.** `POST /v1/videos/:id/views` gets 65's `text/plain` parser (the shared beacon parser moves to one plugin
  both routes use, not a second copy) and a per-minute rate limit from config, as `recordPlayback` has.
- **Watch time has one source.** `watchSeconds` on the view beacon becomes a qualification only (the anti-fraud gate in
  `qualifyView` is unchanged) and stops adding to the buffer. `PlaybackTelemetryService` adds each playback event's
  `watchedSeconds` to the view buffer's `|watch` field through a new `ViewBufferPort.recordWatch`, so watch time counts every
  second played, rewatches included, while views stay one per viewer per day. The flush and `video_views_daily.watch_seconds`
  are unchanged, and it builds on 114's hour-granular field.
- **Device.** `VIEW_DEVICES = ['desktop', 'mobile', 'tablet', 'unknown']` in `@vp/domain`; the beacon's optional `device`
  is `z.enum(VIEW_DEVICES)` in `@vp/api-contracts`, and a missing one counts as `unknown`. The client decides it with one pure
  function in `@vp/web-telemetry` from two facts, a coarse pointer and the screen's short side (coarse and under 600 px:
  `mobile`; coarse otherwise: `tablet`; else `desktop`). No user agent is read or stored, on either side.
- **Storage.** Table `video_views_device_daily` in `@vp/db` (`video_id` cascade, `view_date`, `device`, `views`; primary
  key `(video_id, view_date, device)`), written by the same flush transaction and batch ledger as `video_views_daily` from a
  third buffer field kind (`{videoId}|{date}|device:{device}`). At most four rows per video per day; no retention job, like
  43's daily table.

### 2. Two endpoints

Both are signed-in, in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1, and authorized through
`decideVideoAnalyticsRead` (404 `VIDEO_NOT_FOUND` for a video the caller cannot see, 403 for one they can but do not own),
so 117's team roles apply with no edit here.

- `GET /v1/creator/videos/:id/audience?range=7d|30d|90d` (43's ranges): `{ videoId, range, from, to, devices: [{ device,
  views, share }] }`, most viewed first, `share` of the range's counted views.
- `GET /v1/creator/videos/:id/benchmark`: `{ videoId, publishedAt, peerCount, days: [{ day, views, p25, median, p75 }] }`
  for `day` 0 to 6 after `ready_at` (UTC days). `views` is the video's cumulative views by the end of that day, `null` for a
  day not reached yet. The envelope is over the channel's up to ten most recent public ready videos that are at least seven
  days old, excluding this one, and is `null` for every day when fewer than three exist.
  - `VideoViewRepositoryPort` gains `firstWeekViews(videoIds)`: one query over `video_views_daily` joined to `videos` grouped
    by day offset, and `recentPeers(ownerId, excludeVideoId, readyBefore, limit)`; postgres and in-memory under 43's
    existing contract spec.
  - Pure functions in `@vp/domain`: `cumulativeFirstWeek(rows, readyAt, today)` and `benchmarkEnvelope(peerSeries)`
    (percentiles by linear interpolation), so the arithmetic runs under both runtimes.

### 3. The studio

On the existing `/videos/$videoId/analytics` route (`apps/client/studio`), loaders with `ensureQueryData`, charts over 60's
`ChartFrame` and charting library and 95's `dataviz` colours, wrappers in `features/analytics/components/`:

- `DeviceSplit`: a horizontal bar list of the three devices with the share and count, an "unknown" row only when it is not
  the whole range, on 60's range control.
- `BenchmarkChart`: this video's cumulative line over the shaded 25th to 75th percentile band and the median line, with a
  table alternative; with fewer than three peers an `EmptyState` line, "Not enough earlier videos to compare".
- `DropOffBadges`: 114's `dropOffMoments(curve, durationSeconds)` as badges over the retention chart ("0:42, 18% leave
  here"), no new computation.
- All numbers and times through `@vp/intl`, all copy through `@vp/messages`.

## Delivery

One stack of three slices:

1. The data: the sender and the tracker change, the views route fix, `recordWatch`, `device` through contract, buffer, flush
   and `video_views_device_daily`, with 114's field shape.
   The data fixes under it already shipped with 123 and 124: the playback beacon counts the view and every second of watch time server-side, so the player sends one beacon, and the views route takes `text/plain` and is rate limited. Only `device` is left here.
2. The endpoints: the repository methods, `cumulativeFirstWeek` and `benchmarkEnvelope`, `audience` and `benchmark`,
   contracts and SDD.
3. The studio components on the analytics route.

Slices 1 and 2 need only 43, 65 and 114; slice 3 waits for 60 and 95.

## Acceptance criteria

- [ ] Watching a video in the web app for 10 seconds adds one view to that video's daily count at the next flush; a second
      session by the same viewer the same day adds none; the beacon is accepted as `text/plain` and a burst over the rate
      limit is refused with 429.
- [ ] Watching 40 seconds across two sessions adds about 40 to the day's `watch_seconds`, not the first beacon's value.
- [ ] A phone-class and a desktop-class viewer produce `mobile` and `desktop` rows in `video_views_device_daily`; a beacon
      without `device` produces `unknown`; no user agent, IP or other identifier reaches the buffer or the table.
- [ ] `GET .../audience` returns the shares for the range and sums to 1; another owner gets 403 and an unseen video 404.
- [ ] `GET .../benchmark` returns the cumulative first week with the percentile envelope from the channel's earlier videos,
      `null` days for the future, and a `null` envelope with fewer than three peers.
- [ ] The analytics page renders the device split, the benchmark chart (or its empty line) and the drop-off badges, and meets
      the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] The flush still applies a batch once, with a spec over the new field kind and a replayed batch.
- [ ] `privilege-escalation.test.ts` gains rows for both endpoints.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Country, region, traffic sources, OS, browser, new versus returning viewers and subscriber cohorts (see above).
- Channel-level audience and benchmark pages: 60 owns the channel dashboard; the video-level endpoints are the unit here.
- A finer retention curve or replay detection; a change of 65's step would break stored curves and needs its own ticket.
- Exports of the new data: a `video_analytics` export column set is 118's to extend.

## Testing plan

- Domain: `it.each` tables over `deviceClassOf`, `cumulativeFirstWeek` (a video younger than a week, a gap day, a video
  published late in the UTC day) and `benchmarkEnvelope` (fewer than three peers, ties, even and odd counts).
- Ingestion: the tracker sends the view beacon once at the threshold and never twice; the views route accepts `text/plain`
  and rate limits; `PlaybackTelemetryService` adds watch seconds on each event; the flush writes the device rows and replays
  a batch once.
- Repositories: 43's contract spec over `firstWeekViews` and `recentPeers` in both implementations.
- Routes: `app.inject()` for the 401, 403 and 404 matrix, range handling and the empty cases.
- Studio: `renderRoute` with MSW over the three components, including the empty benchmark.
- E2E: play a video, flush the buffer, open the studio page and read the numbers.

## Open questions

- Decided: watch time counts every second played and views count one per viewer per day, so an average view duration can
  exceed a video's length for someone who rewatches; the studio shows the numbers as stored.
- Decided: device is a client-reported three-value class, because the server can only guess it from a user agent that is
  fingerprint material.
- Decided: the benchmark compares a video with its own channel's earlier first weeks, never with other channels, so it needs
  no cross-channel data.
- Product call, not decided here: country. A privacy-first option is a coarse country read from `cf-ipcountry` where the
  header exists and "unknown" elsewhere, stored as a daily count per country and no more; it deserves its own ticket if wanted.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5 (the table), §6.1, §6.2 and the views-flush section updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
