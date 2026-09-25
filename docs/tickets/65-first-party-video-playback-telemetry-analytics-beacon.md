# 65: First-party video playback telemetry, QoS & creator audience analytics beacon

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#65](https://github.com/szebest/taitube-platform/issues/65) |
| Size | M |
| Blocked by | 43 - Views buffer · 57 - Production player · 64 - Web Vitals · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §13 Observability](../SDD.md#13-autoscaling--observability) |

**Status:** blocked

## What to build

To power real YouTube Studio analytics (watch time, audience retention graphs, rebuffering percentage, and device breakdown) without depending on intrusive third-party trackers, we need a **first-party, privacy-preserving playback telemetry engine**.

This ticket delivers:
1. **Lightweight Playback Telemetry Beacon in the player (`apps/web/src/features/player/`)**:
   - Captures key QoS (Quality of Service) and engagement milestones:
     - `playback_start` (startup time / time-to-first-frame in ms).
     - `heartbeat` (sent every 30s during active playback, reporting segment duration watched).
     - `rebuffer` (tracks buffering events, stall duration, and dropped frames).
     - `quality_change` (tracks ABR switches between 1080p, 720p, 480p).
     - `playback_ended` (total watch time and completion rate).
2. **High-Throughput Ingestion Endpoint (`POST /v1/telemetry/playback`)**:
   - Non-blocking beacon collector using `navigator.sendBeacon`.
   - Aggregates metrics into Prometheus (`video_playback_starts_total`, `video_rebuffering_ratio`, `video_watch_time_seconds_total`).
3. **Audience Retention Graph Data for Creators**:
   - Stores watch percentage milestones (e.g. 10%, 25%, 50%, 75%, 100%) in `video_retention_milestones` table.
   - Powers the Creator Studio audience retention curve (`GET /v1/creator/videos/:id/retention`), revealing where viewers drop off.
4. **Privacy-First Design**:
   - Zero cookies or personal identifiers; sessions identified solely by an ephemeral, client-generated playback UUID that rotates with every video load.

## Acceptance criteria

- [ ] Telemetry tracker in `apps/web/src/features/player/telemetry/playback-tracker.ts` attached to Vidstack player events, running on the client only.
- [ ] Non-blocking beacon transmission using `navigator.sendBeacon` upon pause, buffer stall, and unmount.
- [ ] Backend ingestion route `POST /v1/telemetry/playback`:
  - Accepts telemetry payload (`videoId`, `sessionUuid`, `eventType`, `currentTime`, `duration`, `rebufferingMs`, `rendition`).
  - Buffers retention milestones in Redis and updates retention percentiles.
- [ ] Database table `video_retention_milestones` storing aggregate viewer drop-off percentages per 5% interval.
- [ ] Creator endpoint `GET /v1/creator/videos/:id/retention` returning retention curve array `[{ percent: 0, viewers: 100 }, { percent: 50, viewers: 78 }, ...]`.
- [ ] Creator Studio renders the retention curve on `/studio/videos/$videoId/analytics` (route from [60](60-creator-studio-dashboard-video-management-ui.md)), data through a route loader and `ensureQueryData`.
- [ ] Prometheus QoS metrics exported and displayed in Grafana dashboard (`video_buffering_ratio`).

## Out of scope

- Cross-site ad-tracking or user behavioral profiling.

## Notes for the implementer

- Always batch heartbeat pings to avoid flooding the backend with network requests.
- Ensure playback tracking pauses immediately when video is paused or backgrounded (`document.visibilityState === 'hidden'`).

## Testing plan

- Player telemetry simulation test: Simulate 60s of video playback with 1 buffering stall, assert `POST /v1/telemetry/playback` emits start, heartbeat, and buffer events.
- Retention curve test: Seed 100 viewer sessions with staggered drop-offs, assert `GET /v1/creator/videos/:id/retention` reflects accurate retention decay.

## Definition of Done

- [ ] Telemetry integration tests green under `pnpm test` and `pnpm --filter @vp/web test`.
- [ ] Zero impact on player frame rates or network performance.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
