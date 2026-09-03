---
name: vp-fastify-sse-problem-json
description: Implement the video-pipeline API conventions on Fastify 5 — RFC 9457 problem+json errors with stable machine-readable codes, zod type provider, JWKS auth with dev bypass, and Server-Sent Events fed by Redis Pub/Sub (snapshot-on-connect, Last-Event-ID replay from video_events, heartbeats, backpressure, per-user limits). Use when adding endpoints, error handling, or anything real-time in apps/api.
license: MIT
metadata:
  project: video-pipeline
  spec: docs/SDD.md §6, §10, §11, ADR-02, ADR-10, ADR-18
---

# Fastify API conventions: errors and SSE

Generic Fastify guidance is in the `fastify-best-practices` skill; this file is what *this* API must do.

## Errors — RFC 9457 `application/problem+json`
- One `setErrorHandler` maps everything: `PermanentError`/`TransientError` (from `@vp/errors`, with a `code` from SDD §6.2) → `{ type, title, status, detail, code, instance }`; zod validation → 400 `VALIDATION_FAILED` with `errors[]`; unknown → 500 `INTERNAL` (message hidden, logged with `requestId`).
- The `code` list is fixed (SDD §6.2: `UPLOAD_TOO_LARGE`, `UPLOAD_SIZE_MISMATCH`, `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_EXPIRED`, `UPLOAD_NOT_OPEN`, `QUOTA_EXCEEDED`, `VIDEO_NOT_FOUND`, `VERSION_CONFLICT`, `FORBIDDEN`, `RATE_LIMITED`, …). Adding a code means editing the SDD in the same PR.
- Every route declares its possible problem responses in the zod/OpenAPI schema so the contract test (ticket 19) can diff against SDD §6.1.
- 404 for a private video the caller does not own (do not leak existence); 409 `VERSION_CONFLICT` for stale optimistic-lock `version`.

## Auth
`@fastify/jwt` with JWKS (`AUTH_JWKS_URL`, RS256/EdDSA), `iss`/`aud` checks; `sub` → `users.id` auto-provisioned. Dev bypass only when `NODE_ENV=development` **and** `AUTH_DEV_USER_ID` is set. Admin: role claim `admin` or `x-admin-token` compared with `timingSafeEqual`. Rate limits keyed by user (fallback IP): uploads 30/min, reads 300/min, reprocess 5/min. `@fastify/under-pressure` for load shedding. `/metrics` on `METRICS_PORT`, never on the public port.

## SSE — `GET /v1/videos/:id/events`, `GET /v1/me/events`
Wire format (SDD §10.1):
```
id: <video_events.id>
event: snapshot | progress | status
data: <json>

: ping        (every SSE_HEARTBEAT_MS = 15 s)
```
Procedure per connection:
1. Authorise exactly like `GET /videos/:id`. Enforce `SSE_MAX_PER_USER` (429) and the per-pod cap.
2. Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive`; use `reply.raw` (hijack), never Fastify serialisation.
3. **Subscribe first** (register the connection in `SseHub` for `video:{id}`/`user:{uid}`), **then** read the snapshot from Postgres and write `event: snapshot`. This ordering closes the gap where an event fires during connect; dedupe by `id`.
4. If `Last-Event-ID` is present, replay `video_events WHERE video_id = $1 AND id > $2 ORDER BY id` before going live. Progress ticks are persisted only every 10 %, so replay may skip intermediate percentages — the snapshot carries the current value.
5. Live events arrive from one **dedicated** ioredis connection per pod in subscriber mode (`PSUBSCRIBE video:* user:*`), validated with the `SseEvent` zod schema (`@vp/events`); fan out in-process. Never share this connection with BullMQ.
6. Backpressure: if `res.write()` returns `false`, coalesce `progress` (keep latest per rendition) until `drain`; **never** drop `status`/error events.
7. Heartbeat comment every 15 s; close idle streams after 30 min (client `EventSource` reconnects automatically with `Last-Event-ID`).
8. Cleanup on `close`/`error`: unregister, decrement `sse_connections`.

Multi-instance: each API pod subscribes independently; test with `docker compose up --scale api=2`. Pub/Sub is loss-tolerant by design — Postgres + snapshot/replay is the source of truth.

Publishers (workers) go through `@vp/events` `publishVideoEvent()`; include `ts` in payloads so k6 can measure end-to-end latency (scenario S6).

## Don'ts
- No WebSockets (ADR-10), no long-polling endpoints.
- No per-request Redis subscriptions.
- No `reply.send()` after hijacking the raw response.
