# 76: Live streaming architecture — RTMP/WHIP ingestion, low-latency HLS packaging & real-time chat sidecar

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#76](https://github.com/szebest/taitube-platform/issues/76) |
| Size | L |
| Blocked by | 38 — User identity · 40 — Reactions · 42 — Threaded comments · 57 — Production video player · 59 — Modern video watch page · 93 — Creator Studio as its own app · 98 — Realtime user event stream |
| Blocks | 78 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** blocked

## What to build

### Architectural Decision: How to Implement YouTube-Grade Live Streaming in a Local-First, Cost-Effective Monorepo?

| Architecture Approach | Latency | Complexity & Infrastructure | VOD DVR Compatibility | Local-First €0 Cost | Verdict |
|---|---|---|---|---|---|
| **Pure WebRTC (SFU / Mediasoup)** | Ultra-low (< 500ms) | Extreme; dedicated SFU processes, UDP port ranges, NAT traversal issues, difficult recording/DVR | Hard to transcode to HLS VOD archive seamlessly | Poor; heavy native build dependencies | **Rejected** |
| **External Cloud SaaS (Mux / Cloudflare Stream / AWS IVS)** | Low (2–4s) | Zero backend code, but completely violates local-first offline rule | Native | Impossible; requires credit card & paid cloud account | **Rejected (Violates SDD P9)** |
| **RTMP / WHIP Ingestion &rarr; FFmpeg Low-Latency HLS (LL-HLS) + Redis Live Chat Engine** | Low (1.5–3s) | Clean separation of concerns; lightweight Node/MediaMTX gateway, existing FFmpeg pipelines, standard S3/MinIO chunk storage, instant VOD archiving | Native: live chunks immediately become `master.m3u8` VOD archive when stream terminates | 100% Local-First; runs inside Docker Compose with €0 cost | **Accepted (Recommended)** |

This ticket delivers the **Live Streaming Subsystem**:

1. **Live Stream Lifecycle & VOD Conversion**:
   - `live_streams` table in Postgres:
     - `id UUIDv7 PK, channel_id UUID FK, title text, description text, stream_key text UNIQUE, status text ('IDLE', 'LIVE', 'ENDED'), current_viewers integer DEFAULT 0, started_at timestamptz, ended_at timestamptz, video_id UUID FK REFERENCES videos(id)`.
   - **Automatic VOD Archive & Publishing Options:**
     - When the live broadcast terminates in OBS/MediaMTX:
       - The live segment playlist is automatically closed with `#EXT-X-ENDLIST` and promoted to `videos` as an on-demand video with zero re-encoding.
       - Creator can configure post-stream visibility: `PUBLIC` (appears immediately on channel feed and search), `UNLISTED`, or `PRIVATE`.
       - Viewers can watch the full recorded stream anytime at `/watch?v={videoId}` or `/live/:id`.

2. **Synchronized Live Chat Replay Engine (YouTube-Alike)**:
   - **`live_chat_messages` table:**
     - `id UUIDv7 PK, live_stream_id UUID FK, user_id UUID FK, message text NOT NULL, offset_ms integer NOT NULL, created_at timestamptz NOT NULL`.
     - `offset_ms` records the exact elapsed milliseconds from stream `started_at` when the message was posted.
   - **During Live Stream:** Messages stream instantly over Redis Pub/Sub to viewers (<50ms) and are batched/buffered to `live_chat_messages`.
   - **Transport: WebSocket for chat, SSE for everything else** ([98](98-realtime-user-event-stream.md), ADR-27). Chat is
     the one live surface where every viewer also sends often (messages, moderation commands, slow-mode acks), so
     `GET /v1/live/:id/chat` upgrades to a WebSocket: typed messages in `@vp/api-contracts`, auth on the upgrade,
     per-user rate limits, a resume cursor so a reconnect replays what it missed from `live_chat_messages`, and
     Redis Pub/Sub fan-out across API pods. Viewer counts and live status are one-way, so they ride the existing
     per-video SSE stream (`live.viewers`, `live.status` on `/v1/videos/:id/events`); a subscribed channel going
     live reaches its subscribers as 98's `live.started` event and [99](99-notifications.md)'s `live` notification.
   - **Discovery**: `GET /v1/live` (public streams live now, for the home's Live now shelf and `/live`), and a
     `live: { videoId, startedAt } | null` field on the channel resource for the rail's live dot and the channel
     page.
   - **During VOD Replay (`/watch?v={videoId}` or `/live/:id` after broadcast ends):**
     - The watch page shows **Live Chat Replay** in the chat slot of the `/live` shell.
     - As the video player advances (`currentTime`), the chat slot dynamically syncs and displays the exact messages posted at that specific second of the live stream!
     - Viewers can pause chat scroll, toggle "Show Live Chat Replay" on/off, or jump to timestamps to see chat reactions during peak moments.

3. **Ingestion & Transcoding Gateway (MediaMTX / Node Ingest Server)**:
   - Lightweight, open-source streaming gateway (MediaMTX container or Node-Media-Server) added to `docker-compose.yml`:
     - **RTMP Ingest Port:** `rtmp://localhost:1935/live/{stream_key}` (compatible with OBS Studio, Streamlabs, and FFmpeg).
     - **WHIP (WebRTC HTTP Ingestion Protocol):** `POST /v1/live/whip` for zero-install direct browser webcam streaming.
   - **Authentication Hook:** Gateway authenticates incoming streams against Fastify `POST /v1/internal/live/auth` via webhook; unauthorized stream keys are instantly dropped.

4. **Low-Latency HLS (LL-HLS) Sliding Window Packaging**:
   - Ingest server pipes incoming video stream to FFmpeg workers:
     - Generates 2-second segments with 500ms partial chunks (`#EXT-X-PART`).
     - Publishes live manifest to MinIO/S3 under `live/{streamId}/index.m3u8` with a 5-segment sliding window (`#EXT-X-MEDIA-SEQUENCE`).
   - Clients consume the live HLS stream through `<TaitubePlayer />` ([57](57-production-video-player-hls-streaming-controls.md)) with the live badge and DVR scrubbing.

5. **OBS Studio Integrations (Browser Source Overlays & Stream Deck Companion)**:
   - **Interactive OBS Browser Sources (studio app `/live/overlay/$overlayToken`)**:
     - Transparent HTML overlays for OBS Studio / Streamlabs (`width=1920, height=1080`):
       - Live Chat Pop-out Overlay: Renders scrolling live chat with animated badge popups and transparent background directly over creator's game/screen.
       - Real-Time Subscriber & Follower Goal Bar: Live animated progress bar showing subscriber milestones.
       - Live Alert Box: Animated banner and sound effect when a user subscribes or sends a super-chat.
   - **Stream Deck / Companion WebSocket API (`/v1/live/companion`)**:
     - Local-first WebSocket bridge allowing Elgato Stream Deck and Bitfocus Companion to:
       - Toggle stream status (Start / Stop).
       - Switch chat modes (Slow mode, Subscribers-only).
       - Trigger instant markers/timestamps in live recording.

6. **Creator Live Studio UI (studio app `/live`, in `apps/client/studio` since [93](93-creator-studio-separate-app.md)) & Live Watch View (web `/live/:id`)**:
   - Creator dashboard: Stream health telemetry (bitrate, FPS, dropped frames), live viewer counter, chat moderation controls, and one-click copy of OBS stream credentials and browser overlay URLs.
   - Viewer watch page: built in the `/live` shell from [95](95-design-system-2.md) (section 8) to
     [docs/design/README.md section 8, Shorts and live](../design/README.md#shorts-and-live): real-time
     low-latency player, and live chat in the shell's chat slot, docked to the right of the player on desktop
     and an overlay with an opacity `Slider` in fullscreen and on a vertical stream. The live badge uses the
     `live` role and nothing else, with its pulsing dot (still under reduced motion); no other element is red.
   - The creator dashboard sits in the studio's `StudioWorkspace` with `StatCard`s for stream health and charts
     on the `dataviz` palettes, as in [60](60-creator-studio-dashboard-video-management-ui.md).

### Smart wrappers

Over web's kit: `LiveStreamChat` over `LiveChat` (`features/live/components/`) and `LiveNowShelf` over `Shelf` (`features/browse/components/`). Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Acceptance criteria

- [ ] Database migration creating `live_streams` table with indexes on `(channel_id, status)` and unique constraint on `stream_key`.
- [ ] RTMP / WHIP streaming gateway configured in `docker-compose.yml` supporting OBS streaming on `rtmp://localhost:1935/live/{stream_key}`.
- [ ] Internal webhook `POST /v1/internal/live/auth` authenticates stream key and transitions stream status from `IDLE` to `LIVE`.
- [ ] FFmpeg live packaging pipeline outputs LL-HLS segments to object storage with 2s segment duration and live sliding window.
- [ ] Live watch page `/live/:id` displays low-latency HLS stream in `<TaitubePlayer />` with live badge and real-time viewer count.
- [ ] Live chat fills the `/live` shell's chat slot: docked beside the player on desktop, an overlay with a
      working opacity slider in fullscreen and on a vertical stream; new messages do not move the reader's
      scroll position while they are scrolled up.
- [ ] The live badge is the `live` role; a scan of the live surfaces finds no other use of `live` or of a red
      value.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] Live chat over a WebSocket (`/v1/live/:id/chat`) with Redis Pub/Sub fan-out, per-user rate limits and a resume
      cursor that replays missed messages after a reconnect; viewer counts and status on the per-video SSE stream.
- [ ] `GET /v1/live` lists streams live now; the channel resource carries `live`; subscribers receive `live.started`.
- [ ] Interactive OBS Browser Source routes (studio app `/live/overlay/$token`) rendering transparent chat pop-outs, alert banners, and subscriber goal progress bars.
- [ ] Stream Deck / Companion WebSocket API (`/v1/live/companion`) enabling external broadcast deck control.
- [ ] Automatic VOD archive: Terminating OBS stream transitions `live_streams.status` to `ENDED`, marks the recorded playlist as a canonical `video` item, and publishes it to the creator's channel with configurable post-stream visibility.
- [ ] Live Chat Replay engine: When watching the recorded VOD, chat messages populate dynamically in real time synchronized with `video.currentTime` matching their original broadcast offset (`offset_ms`).
- [ ] Integration test: Stream synthetic test pattern via FFmpeg CLI to RTMP port; assert HLS live playlist appears in MinIO, messages record with offsets, and VOD player renders synchronized chat replay.

## Out of scope

- Peer-to-peer WebRTC mesh streaming.
- Paid super-chat credit card payment processing.

## Notes for the implementer

- **Local-first compliance:** The entire live streaming stack must run offline in Docker Compose with zero third-party cloud streaming dependencies.
- **File Length Discipline:** Modularize live streaming handlers and chat socket services under `apps/server/api/src/live/` with each file <= 250 lines.

## Testing plan

- Ingest test: Run `ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 -c:v libx264 -f flv rtmp://localhost:1935/live/{key}`; verify live HLS manifest is accessible at `http://localhost:9000/public/live/{id}/index.m3u8`.
- Chat concurrency test: Simulate 100 concurrent clients sending chat messages; assert Redis Pub/Sub fans out to all connections under 50ms latency.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] Live streaming functional in local dev environment with OBS Studio.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
