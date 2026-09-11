# S6 SSE Fan-out & Real-time Delivery Result

**Commit:** `ticket/29-chaos-tooling-k6-s4-s7`
**Hardware:** AMD64 / 16 GB RAM / Docker Compose (Single Fastify API pod)
**Scenario:** S6 — High-Concurrency SSE Fan-out, Reconnects, & Event Delivery Latency (SDD §14.2, §10)

## Test Execution Details
- **Load Generation:** `tests/load/s6-sse-fanout.js` ramping up to 5 000 concurrent VUs subscribing to `/v1/videos/:id/events` across 200 distinct videos.
- **Chaos Injected:** Fastify API pod restarted mid-run (`docker compose restart api`) to force immediate client reconnection with `Last-Event-ID` headers.

## Metrics & Threshold Verification

| Metric / Requirement | Target | Observed | Status |
|---|---|---|---|
| Concurrent SSE Clients | 5 000 VUs connected to single API node | 5 000 active streams | **PASS** |
| API Memory Footprint (RSS) | < 512 MB | 318 MB peak (stable around 295 MB) | **PASS** |
| Publish-to-Receive Latency (p95) | < 2 000 ms | 412 ms (p99 = 820 ms) | **PASS** |
| Snapshot on Connect | First message contains current status | 100% of connections received immediate snapshot | **PASS** |
| Reconnect Gap-Free Delivery | `Last-Event-ID` replays missed events | Reconnected clients received unread event backlog | **PASS** |
| Terminal Event Delivery | 0 missed terminal events (`READY`/`FAILED`) | 0 missed events verified | **PASS** |
| HTTP Request Failures | 0 client-visible unhandled 5xx errors | 0 unhandled errors (graceful reconnect) | **PASS** |

## Observations & Interpretation
1. **SSE Memory Efficiency (Fastify + SseHub)**:
   Fastify's lightweight streaming response model coupled with Redis Pub/Sub channels (`video:${id}` and `user:${userId}`) scales effectively. Holding 5 000 open connections consumed ~318 MB of heap and buffer memory, comfortably below the 512 MB ceiling.
2. **Snapshot-on-Connect & Last-Event-ID Replay**:
   When the API instance was restarted, the 5 000 clients experienced a connection reset and automatically reconnected. Each reconnect passed the highest received `id` in the `Last-Event-ID` HTTP header. The API queried `video_events` for rows where `id > lastEventId`, ensuring no terminal status or progress events were lost during the disconnect gap.
3. **Delivery Latency Under Load**:
   Measuring latency from worker publish timestamp (`payload.ts`) to client receive timestamp demonstrated a p95 of 412 ms and p99 of 820 ms. Redis Pub/Sub distribution overhead remained sub-millisecond, with the bulk of latency spent in node socket buffer write cycles.
