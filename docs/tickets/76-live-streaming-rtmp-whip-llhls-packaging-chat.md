# 76: Live streaming architecture — RTMP/WHIP ingestion, low-latency HLS packaging & real-time chat sidecar

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 38 — User identity · 40 — Reactions · 42 — Threaded comments · 57 — Production video player · 59 — Modern video watch page |
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
   - **During VOD Replay (`/watch?v={videoId}` or `/live/:id` after broadcast ends):**
     - The Watch Page displays a **"Live Chat Replay"** tray sidecar.
     - As the video player advances (`currentTime`), the chat tray dynamically syncs and displays the exact messages posted at that specific second of the live stream!
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
   - Clients consume the live HLS stream through Vidstack player with `<LiveIndicator />` badge and DVR scrubbing capability.

5. **OBS Studio Integrations (Browser Source Overlays & Stream Deck Companion)**:
   - **Interactive OBS Browser Sources (`/studio/live/overlay/:overlayToken`)**:
     - Transparent HTML overlays for OBS Studio / Streamlabs (`width=1920, height=1080`):
       - Live Chat Pop-out Overlay: Renders scrolling live chat with animated badge popups and transparent background directly over creator's game/screen.
       - Real-Time Subscriber & Follower Goal Bar: Live animated progress bar showing subscriber milestones.
       - Live Alert Box: Animated banner and sound effect when a user subscribes or sends a super-chat.
   - **Stream Deck / Companion WebSocket API (`/v1/live/companion`)**:
     - Local-first WebSocket bridge allowing Elgato Stream Deck and Bitfocus Companion to:
       - Toggle stream status (Start / Stop).
       - Switch chat modes (Slow mode, Followers-only).
       - Trigger instant markers/timestamps in live recording.

6. **Creator Live Studio UI (`/studio/live`) & Live Watch View (`/live/:id`)**:
   - Creator dashboard: Stream health telemetry (bitrate, FPS, dropped frames), live viewer counter, chat moderation controls, and one-click copy of OBS stream credentials and browser overlay URLs.
   - Viewer watch page: Real-time low-latency player, synchronized live chat tray, and "LIVE" red pulsating pill badge.

## Acceptance criteria

- [ ] Database migration creating `live_streams` table with indexes on `(channel_id, status)` and unique constraint on `stream_key`.
- [ ] RTMP / WHIP streaming gateway configured in `docker-compose.yml` supporting OBS streaming on `rtmp://localhost:1935/live/{stream_key}`.
- [ ] Internal webhook `POST /v1/internal/live/auth` authenticates stream key and transitions stream status from `IDLE` to `LIVE`.
- [ ] FFmpeg live packaging pipeline outputs LL-HLS segments to object storage with 2s segment duration and live sliding window.
- [ ] Live watch page `/live/:id` displays low-latency HLS stream in `<TaitubePlayer />` with live badge and real-time viewer count.
- [ ] High-throughput live chat engine powered by Redis Pub/Sub fanning out messages to viewers via SSE or WebSocket.
- [ ] Interactive OBS Browser Source routes (`/studio/live/overlay/:token`) rendering transparent chat pop-outs, alert banners, and subscriber goal progress bars.
- [ ] Stream Deck / Companion WebSocket API (`/v1/live/companion`) enabling external broadcast deck control.
- [ ] Automatic VOD archive: Terminating OBS stream transitions `live_streams.status` to `ENDED`, marks the recorded playlist as a canonical `video` item, and publishes it to the creator's channel with configurable post-stream visibility.
- [ ] Live Chat Replay engine: When watching the recorded VOD, chat messages populate dynamically in real time synchronized with `video.currentTime` matching their original broadcast offset (`offset_ms`).
- [ ] Integration test: Stream synthetic test pattern via FFmpeg CLI to RTMP port; assert HLS live playlist appears in MinIO, messages record with offsets, and VOD player renders synchronized chat replay.

## Out of scope

- Peer-to-peer WebRTC mesh streaming.
- Paid super-chat credit card payment processing.

## Notes for the implementer

- **Local-first compliance:** The entire live streaming stack must run offline in Docker Compose with zero third-party cloud streaming dependencies.
- **File Length Discipline:** Modularize live streaming handlers and chat socket services under `apps/api/src/live/` with each file <= 250 lines.

## Testing plan

- Ingest test: Run `ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 -c:v libx264 -f flv rtmp://localhost:1935/live/{key}`; verify live HLS manifest is accessible at `http://localhost:9000/public/live/{id}/index.m3u8`.
- Chat concurrency test: Simulate 100 concurrent clients sending chat messages; assert Redis Pub/Sub fans out to all connections under 50ms latency.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] Live streaming functional in local dev environment with OBS Studio.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
