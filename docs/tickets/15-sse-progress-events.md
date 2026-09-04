# 15: Live status — workers publish progress, clients subscribe via SSE with snapshot, replay and heartbeat

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | M–L |
| Blocked by | 07 — Playable READY video · 04 — API skeleton |
| Blocks | 20 |
| Spec | [PRD US-11](../PRD.md#53-status-feedback) · [PRD FR-8](../PRD.md#6-functional-requirements) · [PRD §7 SSE SLOs](../PRD.md#7-non-functional-requirements-slos) · [SDD §10 Real-time status (wire format, fan-out, limits)](../SDD.md#10-real-time-status-sse) · [SDD §20 `SseEvent`](../SDD.md#20-appendix-job-contracts-code) · [ADR-10](../SDD.md#adr-10-status-transport-server-sent-events) |

**Status:** done

## What to build
Open the test page, subscribe to a processing video: you see a `snapshot` immediately, then `progress` events per rendition (≤ one per 2 s), then `status: READY`. Kill the API container and bring it back: the browser reconnects with `Last-Event-ID` and receives exactly the persisted transitions it missed. Workers publish through `packages/events`; each API instance holds one `PSUBSCRIBE` and fans out to its local connections; `/v1/me/events` streams everything for the caller's videos. Heartbeat comments keep proxies open; slow clients get progress coalesced, never terminal events dropped.

## Acceptance criteria
- [x] Wire format matches SDD §10.1 (`id` = `video_events.id`, `event` ∈ snapshot|progress|status, `: ping` every 15 s).
- [x] First frame after connect is `snapshot` from Postgres, then live events; subscribe-before-read ordering, deduplicated by `id` (test with an event fired during connect).
- [x] Reconnect with `Last-Event-ID` replays `video_events` after that id; a client that missed `READY` receives it on reconnect.
- [x] Progress from workers throttled to 1 per 2 s per rendition and persisted only every 10 %; publish→receive p95 < 2 s locally.
- [x] Limits enforced: 20 streams/user → 429; per-pod cap via under-pressure; idle streams closed at 30 min; authorisation identical to `GET /videos/:id`.
- [x] Backpressure: with a deliberately slow reader, progress events are coalesced (latest wins) and `status` events are never dropped (test with a paused socket).
- [x] Two API instances behind a round-robin (compose `--scale api=2`) both deliver events for the same video.

## Out of scope
WebSockets, webhooks (16 carries HMAC webhook as optional).

## Notes for the implementer
- Dedicated ioredis connection in subscriber mode; never share it with BullMQ.
- Include `ts` in every published payload so k6 can measure end-to-end latency in 29 (S6).

## Testing plan
Integration with a raw HTTP client parsing `text/event-stream`; multi-instance test in compose; manual test-page demo (GIF in PR).

## Open questions
- None.

## Definition of Done
- [x] AC green; test page shows live bars; SDD §10 unchanged or updated in the same PR.

## Code Review
- **Status:** Approved
- **Review Report:** [Review Report](../reviews/15-sse-progress-events-review.md)
- **Key Findings:**
  - Full compliance with AC 1–7, SDD §10, §20, ADR-10, PRD US-11, PRD FR-8, and PRD §7.
  - Wire format conforms to SDD §10.1 (`snapshot`, `progress`, `status`, `: ping` comment every 15s).
  - Subscribe-before-read connection sequence eliminates race conditions with snapshot emitted first and in-flight events deduplicated.
  - Reconnection via `Last-Event-ID` re-queries PostgreSQL `video_events` and reliably re-synchronizes missed progress and terminal `READY` states.
  - Worker progress reporting throttled to 1 per 2 seconds per rendition and persisted only at 10% decile boundaries, safeguarding database throughput.
  - Connection quotas (20 streams/user → 429), pod caps, 30-minute idle stream timeouts, and private video authorization strictly enforced.
  - Socket backpressure coalesces ephemeral progress events per rendition while preserving terminal status events without loss.
  - Multi-instance fan-out over Redis Pub/Sub (`video:*`, `user:*`) verified across multiple API instances.

