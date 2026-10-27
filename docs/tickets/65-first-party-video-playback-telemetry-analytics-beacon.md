# 65: First-party video playback telemetry, QoS & creator audience analytics beacon

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#65](https://github.com/szebest/taitube-platform/issues/65) |
| Size | M |
| Blocked by | 43 - Views buffer · 57 - Production player · 64 - Web Vitals · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app |
| Blocks | 114, 116, 118, 122, 123, 126, 127, 128 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §13 Observability](../SDD.md#13-autoscaling--observability) |

**Status:** done

## What to build

To power real YouTube Studio analytics (watch time, audience retention graphs, rebuffering percentage, and device breakdown) without depending on intrusive third-party trackers, we need a **first-party, privacy-preserving playback telemetry engine**.

This ticket delivers:
1. **Lightweight Playback Telemetry Beacon in the player (`apps/client/web/src/features/player/`)**:
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

- [x] Telemetry tracker in `apps/client/web/src/features/player/telemetry/playback-tracker.ts` fed by the `TaitubePlayer` port's playback events (play, pause, waiting, time, quality), running on the client only.
- [x] Non-blocking beacon transmission using `navigator.sendBeacon` upon pause, buffer stall, and unmount.
- [x] Backend ingestion route `POST /v1/telemetry/playback`:
  - Accepts telemetry payload (`videoId`, `sessionUuid`, `eventType`, `currentTime`, `duration`, `rebufferingMs`, `watchedSeconds`, `rendition`).
  - Buffers retention milestones in Redis (in the view buffer) and the `flush-video-views` task drains them into the table.
- [x] Database table `video_retention_milestones` storing aggregate viewer drop-off percentages per 5% interval.
- [x] Creator endpoint `GET /v1/creator/videos/:id/retention` returning retention curve array `[{ percent: 0, viewers: 100 }, { percent: 50, viewers: 78 }, ...]`.
- [x] Creator Studio renders the retention curve on `/videos/$videoId/analytics` in `apps/client/studio` (the studio app from [93](93-creator-studio-separate-app.md), routes from [60](60-creator-studio-dashboard-video-management-ui.md)), data through a route loader and `ensureQueryData`.
- [x] Prometheus QoS metrics exported and displayed in Grafana dashboard (`video_buffering_ratio`).

## Out of scope

- Cross-site ad-tracking or user behavioral profiling.

## Notes for the implementer

- Always batch heartbeat pings to avoid flooding the backend with network requests.
- Ensure playback tracking pauses immediately when video is paused or backgrounded (`document.visibilityState === 'hidden'`).

## Testing plan

- Player telemetry simulation test: Simulate 60s of video playback with 1 buffering stall, assert `POST /v1/telemetry/playback` emits start, heartbeat, and buffer events.
- Retention curve test: Seed 100 viewer sessions with staggered drop-offs, assert `GET /v1/creator/videos/:id/retention` reflects accurate retention decay.

## Definition of Done

- [x] Telemetry integration tests green under `pnpm test` and `pnpm --filter @vp/web test`.
- [x] Zero impact on player frame rates or network performance.
- [x] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [x] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
