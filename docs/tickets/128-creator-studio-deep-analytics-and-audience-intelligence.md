# 128: Creator Studio Deep Analytics & Audience Intelligence — demographic breakdowns, retention heatmaps & watch time insights

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | XL (delivered as three slices, see *Delivery*) |
| Blocked by | 43 - Views buffer and creator analytics · 60 - Creator studio dashboard · 65 - Playback telemetry · 93 - Creator Studio separate app · 95 - Design system 2 · 125 - User engagement & activity history engine |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13 Observability](../SDD.md#13-autoscaling--observability) |

**Status:** blocked

> **Why.** (written by Gemini, let Claude verify)
> YouTube Studio's analytics suite is famous for its depth: creator watch time, audience retention, geographic clusters, device distributions, and viewer returning rates. However, YouTube Studio is notoriously slow, withholds granular retention dips, obfuscates second-by-second drop-offs with heavy smoothing, and provides creators with zero actionable breakdown of *why* viewers leave at specific video timestamps (e.g. intro drop-offs, sponsored segments, audio glitches).
> In our platform today, [43](43-high-scale-video-views-buffer-reconciler.md) collects basic daily views, [65](65-first-party-video-playback-telemetry-analytics-beacon.md) aggregates 5% retention milestone buckets, and [125](125-user-engagement-and-activity-history-engine.md) records high-resolution user session durations. But Creator Studio lacks:
> 1. Deep demographic and audience breakdown (country/geography, device type, OS, traffic sources).
> 2. Second-by-second audience retention heatmaps with automated drop-off anomaly detection (highlighting intro drop-offs, engagement spikes, and re-watched highlights).
> 3. Subscriber conversion and returning viewer curves (new viewers vs returning viewers, watch time per cohort).
> 4. Performance benchmarking (comparing a video's first 24h/7d watch time against the channel's top 10 historical averages).
> This ticket builds a state-of-the-art Creator Analytics suite in `apps/client/studio` that is faster, more transparent, and significantly more actionable than YouTube Studio.

## What to build (written by Gemini, let Claude verify)

### 1. Data Aggregation & Demographic Engine (`@vp/db` & `@vp/adapters`)
- **Table `video_playback_demographics`**:
  - `id` (UUIDv7), `video_id` (UUID, FK -> `videos.id`), `channel_id` (UUID), `date` (date), `country_code` (char(2)), `device_type` (`desktop | mobile | tablet | tv`), `os` (varchar(32)), `browser` (varchar(32)), `view_count` (int), `watch_time_seconds` (bigint), `avg_duration_seconds` (int).
  - Derived from privacy-preserving playback beacons in [65](65-first-party-video-playback-telemetry-analytics-beacon.md) and IP-to-country headers (`cf-ipcountry` on Cloudflare or local geo-resolver).
  - Primary key `(video_id, date, country_code, device_type)`.
- **Table `video_retention_spikes`**:
  - `video_id`, `second_interval` (int), `retention_ratio` (numeric(4,3)), `event_tag` (`intro_drop | spike | rewatch_hotspot | steady`).
  - Computed by background analytics job using derivative sliding-window slope analysis over session playheads.

### 2. High-Performance Creator Analytics API (`@vp/api-contracts` & `apps/server/api`)
- **Endpoints**:
  - `GET /v1/creator/videos/:id/audience`:
    - Returns country distribution (top 20 countries, watch time shares), device breakdown (`desktop`, `mobile`, `tablet`, `tv`), and client platforms.
  - `GET /v1/creator/videos/:id/retention-heatmap`:
    - Second-by-second retention curve with tagged segments:
      - **Intro Drop**: Percentage of viewers lost in the first 30 seconds.
      - **Spikes**: Moments where viewers scrubbed backward or replayed.
      - **Dips**: Timestamps with abnormal drops in viewer attention.
  - `GET /v1/creator/channel/cohorts`:
    - Returning vs New Viewers breakdown over 7d/28d/90d/365d: watch time contribution, average view duration per cohort.
  - `GET /v1/creator/videos/:id/benchmark`:
    - Compares current video view trajectory against the channel's typical performance envelope (top 25% percentile, median, bottom 25% percentile).

### 3. Studio Interactive Analytics Experience (`apps/client/studio`)
- Routes under `apps/client/studio/src/routes/_authed/analytics/` and `/videos/$videoId/analytics`:
  - **Audience Tab**:
    - **Interactive Geo Map / Table**: World choropleth map using vector paths or compact sorted table with flag icons and percentage bars.
    - **Device & Platform Donut Charts**: Device breakdown using `@vp/ui` chart primitives and dataviz tokens.
  - **Retention Heatmap Inspector**:
    - Interactive SVG retention curve: hovering displays video thumbnail preview at that exact second, remaining viewer percentage, and difference from channel benchmark.
    - Automated diagnostic badges: *"Strong intro (88% kept past 0:30)"*, *"Drop-off at 04:12 (-14% drop)"*.
  - **Benchmark Overlays**:
    - Trajectory chart comparing Video A's first 48 hours to the channel's typical range with shaded confidence bands.
  - **Cohort View (New vs Returning)**:
    - Stacked area chart showing how many views come from loyal subscribers vs discovery viewers from [126](126-discovery-and-recommendation-intelligence.md).

## Acceptance criteria (written by Gemini, let Claude verify)

- [ ] New tables `video_playback_demographics` and retention analysis schema deployed via Drizzle migration. (written by Gemini, let Claude verify)
- [ ] Telemetry ingestion derives country from request headers (`cf-ipcountry`) and user-agent client hints without storing personal IP addresses. (written by Gemini, let Claude verify)
- [ ] Retention heatmap computes second-by-second curve and identifies intro drops and replay spikes via slope detection algorithms in `@vp/domain`. (written by Gemini, let Claude verify)
- [ ] `GET /v1/creator/videos/:id/audience` returns geo, device, and cohort aggregates under 50ms with Redis caching. (written by Gemini, let Claude verify)
- [ ] Studio renders the interactive Audience and Heatmap tabs with responsive charts, tooltip scrubbing, and benchmark comparison envelopes. (written by Gemini, let Claude verify)
- [ ] All permissions strictly guarded by CASL ability (`can('read', 'Analytics', { channelId })`). (written by Gemini, let Claude verify)
- [ ] 100% test coverage matching Rule 12 across services, routes, and UI components. (written by Gemini, let Claude verify)
