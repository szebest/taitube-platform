# 15: Live status — workers publish progress, clients subscribe via SSE with snapshot, replay and heartbeat

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | M–L |
| Blocked by | 07 — Playable READY video · 04 — API skeleton |
| Blocks | 20 |
| Spec | [PRD US-11](../PRD.md#53-status-feedback) · [PRD FR-8](../PRD.md#6-functional-requirements) · [PRD §7 SSE SLOs](../PRD.md#7-non-functional-requirements-slos) · [SDD §10 Real-time status (wire format, fan-out, limits)](../SDD.md#10-real-time-status-sse) · [SDD §20 `SseEvent`](../SDD.md#20-appendix-job-contracts-code) · [ADR-10](../SDD.md#adr-10-status-transport-server-sent-events) |

**Status:** ready-for-agent

## What to build
Open the test page, subscribe to a processing video: you see a `snapshot` immediately, then `progress` events per rendition (≤ one per 2 s), then `status: READY`. Kill the API container and bring it back: the browser reconnects with `Last-Event-ID` and receives exactly the persisted transitions it missed. Workers publish through `packages/events`; each API instance holds one `PSUBSCRIBE` and fans out to its local connections; `/v1/me/events` streams everything for the caller's videos. Heartbeat comments keep proxies open; slow clients get progress coalesced, never terminal events dropped.

## Acceptance criteria
- [ ] Wire format matches SDD §10.1 (`id` = `video_events.id`, `event` ∈ snapshot|progress|status, `: ping` every 15 s).
- [ ] First frame after connect is `snapshot` from Postgres, then live events; subscribe-before-read ordering, deduplicated by `id` (test with an event fired during connect).
- [ ] Reconnect with `Last-Event-ID` replays `video_events` after that id; a client that missed `READY` receives it on reconnect.
- [ ] Progress from workers throttled to 1 per 2 s per rendition and persisted only every 10 %; publish→receive p95 < 2 s locally.
- [ ] Limits enforced: 20 streams/user → 429; per-pod cap via under-pressure; idle streams closed at 30 min; authorisation identical to `GET /videos/:id`.
- [ ] Backpressure: with a deliberately slow reader, progress events are coalesced (latest wins) and `status` events are never dropped (test with a paused socket).
- [ ] Two API instances behind a round-robin (compose `--scale api=2`) both deliver events for the same video.

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
- [ ] AC green; test page shows live bars; SDD §10 unchanged or updated in the same PR.
