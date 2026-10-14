---
name: fastify-sse-problem-json
description: >-
  HTTP API conventions on Fastify: RFC 9457 problem+json errors with stable codes, auth and
  rate limits, and Server-Sent Events fed by pub/sub (subscribe before the snapshot,
  Last-Event-ID replay, heartbeats, backpressure, connection caps). Use when adding an
  endpoint, error handling, or anything real-time in the API.
license: MIT
---

# Fastify API conventions: errors and SSE

Fastify in general: `fastify-best-practices`. This API's codes, settings, routes and
helpers: `references/this-repo.md`.

## Errors: RFC 9457 `application/problem+json`

- **One error handler maps everything** to `{ type, title, status, detail, code, instance }`:
  domain failures with their code, schema validation to 400 with the field errors, anything
  unknown to 500 with the message hidden and logged with the request id.
- **The code vocabulary is closed**: a client branches on `code`, never on `detail`. A new
  code is added to the shared error package and its design doc in the same PR.
- **Every route declares its problem responses** in its schema, so the published contract
  lists them and a contract test can diff them.
- A private resource the caller may not see is a 404, never a 403 that confirms it exists;
  a stale optimistic-lock version is a 409.

## Auth and limits

- Tokens verified against a JWKS with issuer and audience checks; the subject maps to a user,
  provisioned on first sight.
- A development bypass needs two switches (the environment and an explicit user id), never
  one.
- Secrets and admin tokens are compared with a timing-safe equality.
- Rate limits keyed by user, falling back to the IP, with separate budgets for expensive
  routes.
- Metrics on their own port, never on the public one.

## Server-Sent Events

Wire format: `id: <event id>`, `event: <type>`, `data: <json>`, a blank line; a heartbeat is a
comment line (`: ping`).

Per connection:

1. **Authorise exactly like the resource's `GET`**, then enforce a per-user and a
   per-instance connection cap (429 past it).
2. **Headers**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
   `X-Accel-Buffering: no`, `Connection: keep-alive`. Write to the raw response after
   hijacking it; nothing is sent through the framework's reply afterwards.
3. **Subscribe first, then read the snapshot** from the database and send it as the first
   event. The order closes the gap where an event fires while the client connects; the
   client dedupes by `id`.
4. **`Last-Event-ID` replays** from the durable event log (`id > last`, in order) before the
   stream goes live. Events persisted at a coarser grain than they are published (progress)
   can skip values on replay; the snapshot carries the current one.
5. **Live events come from one dedicated pub/sub connection per instance**, validated
   against the event schema and fanned out in process. Never a subscription per request,
   and never the queue's connection.
6. **Backpressure**: when a write returns `false`, coalesce the lossy events (keep the
   latest progress per key) until `drain`; never drop a status or error event.
7. **Heartbeat** on a fixed interval, close idle streams after a while (the browser's
   `EventSource` reconnects with `Last-Event-ID`), and on `close` or `error` unregister and
   decrement the connection gauge.

Each instance subscribes on its own, so test with two. Pub/sub is lossy by design: the
database, the snapshot and the replay are the source of truth. Publishers put a timestamp
in each payload so a load test can measure end-to-end latency.

## Never

WebSockets or long polling for one-way updates, a per-request subscription, or a reply
through the framework after hijacking the raw response.
