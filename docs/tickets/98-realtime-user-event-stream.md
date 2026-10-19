# 98: Realtime - one typed user event stream over SSE, shared across tabs, feeding the query cache

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 15 - Live status (SSE) · 17 - Housekeeping · 53 - Frontend data layer |
| Blocks | 76, 99, 103 |
| Spec | [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** in-progress

> **Why.** `GET /v1/me/events` streams processing events for the caller's own videos and nothing else. The
> features queued behind this ([99](99-notifications.md) notifications, [103](103-comment-hearts-reports-creator-inbox.md)
> the creator's comment inbox, [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md) live start, [97](97-account-preferences-api.md)
> preferences on another device) all need to push something to one signed-in person. One stream, typed and
> replayable, serves all of them; each feature adds an event type, not a connection.

## Transport: SSE, and why not WebSocket

| Need | SSE | WebSocket | Polling |
|---|---|---|---|
| Direction | server to client, which is all these events are | both ways, unused here | client pulls |
| Already built | `SseHub`, Redis Pub/Sub fan-out, snapshot and `Last-Event-ID` replay (SDD §10) | a second protocol stack, its own auth, heartbeats and replay | nothing to build, but late and wasteful |
| Through the tunnel, proxies, HTTP/2 | plain HTTP, multiplexed on HTTP/2 | upgrade path, sticky connections | fine |
| Reconnect and missed events | built in: `Last-Event-ID` replays from the event log | hand-rolled | gaps between polls |

SSE for every server-to-client stream; WebSocket only where the client also sends often (live chat in 76,
watch-together in [78](78-discord-integration-bot-watch-together-activity-creator-alerts.md)). SDD gains
**ADR-27: realtime transport**, stating that split.

## What to build

### 1. The event envelope

In `@vp/api-contracts`, one discriminated union keyed by `type`, each with its own payload schema:

| `type` | Payload | Producer |
|---|---|---|
| `video.processing` | today's progress and status payload | the worker (unchanged, moved into the union) |
| `notification.created` | the notification as `GET /v1/me/notifications` returns it, plus the unread count | 99 |
| `notification.read` | ids (or `all`) and the unread count, so other tabs and devices clear their badge | 99 |
| `live.started`, `live.ended` | channel and live video summary | 76, for channels the viewer subscribes to |
| `comment.created` | the comment and its video, for the video's owner | 103 |
| `preferences.updated` | the changed sections and `version` | 97, so another open device applies them |

A new event type is a schema in the union, a producer, and a cache handler (section 3); nothing else changes.

### 2. The server

- **An event log**, `user_events` in `@vp/db`: `id` (bigserial, the SSE `id`), `user_id`, `type`, `payload` (jsonb),
  `created_at`; one migration. Producers write the row and publish on the existing `user:{userId}` channel in the
  same unit of work as the change that caused it (through the transactional outbox where the change is a DB
  write, [30](30-transactional-outbox.md)).
- **`GET /v1/me/events`** keeps its path and becomes the typed stream: on connect a `hello` event carries the
  current unread notification count and the viewer's live subscriptions, then the stream replays `user_events`
  after `Last-Event-ID`, then goes live. Heartbeat, limits and backpressure as SDD §10 (never coalesce anything
  but `video.processing` progress).
- **Retention**: the housekeeping stage ([17](17-housekeeping-reconciler-purge.md)) deletes `user_events` older
  than seven days; a client reconnecting after longer gets `hello` and refetches.
- **Auth**: the stream accepts the same bearer token as every other `/v1/me` route, and the session cookie once
  [56](56-frontend-universal-auth-session-security.md) lands.

### 3. The client, in `@vp/queries`

- **One connection per browser, not per tab**: the first tab takes a Web Lock and owns the stream; the others
  receive its events over a `BroadcastChannel`, and one of them takes over when the owner closes. This keeps a
  viewer with ten tabs at one connection.
- **Fetch-based streaming** (a `ReadableStream` reader with the `Authorization` header), because `EventSource`
  cannot send a header; reconnect with backoff and `Last-Event-ID`; pause while offline (TanStack Query's
  `onlineManager`) and resume on focus.
- **`useUserEvent(type, handler)`** for a component that must react (a toast), and **one handler registry** mapping
  each `type` to query-cache work (patch the unread count, prepend a notification, invalidate the creator inbox),
  typed by the union, so a missing handler is a compile error.
- Both apps mount it once at their root for a signed-in viewer.

## Acceptance criteria

- [ ] An event written for a user reaches every open tab of that user's browser over one connection; closing the
      owning tab moves the stream to another tab with no lost event.
- [ ] Disconnecting for a minute and reconnecting replays exactly the events missed (by `Last-Event-ID`).
- [ ] A client reconnecting after the retention window gets `hello` and refetches, with no error.
- [ ] Today's processing progress in the studio works unchanged on the typed stream.
- [ ] Adding an event type without a cache handler fails the typecheck.
- [ ] Events are produced in the same unit of work as their cause: a rolled-back change emits nothing.
- [ ] ADR-27 in the SDD and §10 updated; the contracts in the OpenAPI document.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, with output
      in the PR.

## Out of scope

- The notifications themselves (99), live chat (76), any event type whose producer is another ticket.
- Web Push to a closed browser: a later ticket, on top of 99.

## Testing plan

- Server: replay after an id, retention cut-off, the outbox path, the per-user connection limit.
- Client: the leader election and hand-over with two simulated tabs; reconnect with `Last-Event-ID`; the handler
  registry patching the cache, through a `QueryClient` in specs.
- E2E: a processing upload updates two open studio tabs from one connection.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
