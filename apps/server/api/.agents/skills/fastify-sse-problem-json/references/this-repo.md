# This API

Design: `docs/SDD.md` §6 (error model and codes), §10 (real-time), §11, ADR-02, ADR-10,
ADR-18. The app's own rules: `apps/server/api/AGENTS.md`.

- **Errors travel as Results**: services return them and `routes/send-result.ts` is the one
  unwrap point under `routes/` (root `AGENTS.md`, rule 14; `docs/standards/error-handling.md`).
  The codes are `packages/universal/errors/src/error-codes.ts` and its siblings; route schemas
  come from `@vp/api-contracts` (`routes/contract-schema.ts`).
- **Settings** (all in `packages/server/env-schema`): `AUTH_JWKS_URL`, `AUTH_DEV_USER_ID`,
  `METRICS_PORT`, `SSE_MAX_PER_USER`, `SSE_HEARTBEAT_MS`.
- **SSE routes** (`routes/events.ts`): `GET /v1/videos/:id/events` streams `snapshot`,
  `progress` and `status` (`@vp/events`), replayed from `video_events`, where progress is
  persisted only every 10%. `GET /v1/me/events` streams `hello` and then the `UserEvent`
  union of `@vp/api-contracts`, replayed from `user_events` (SDD §10.3). `SseHub` holds the
  connections per `video:{id}` and `user:{uid}` channel; `services/sse-frames.ts` turns each
  channel's message into a frame and decides which frames coalesce.
- **Two instances**: `apps/server/api/src/__tests__/sse-events.test.ts` ("delivers an event
  for one video through two API instances that share a cache") proves the fan-out; the S6
  scenario in `chaos-toxiproxy` load-tests it.
