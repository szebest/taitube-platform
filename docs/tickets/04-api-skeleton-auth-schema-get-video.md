# 04: API skeleton + auth + full database schema — `GET /v1/videos/:id` returns a video

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Issue | [#4](https://github.com/szebest/taitube-platform/issues/4) |
| Size | L (largest foundation slice; still one session if the DDL is copied from the SDD) |
| Blocked by | 01 — Repo skeleton · 03 — Dev tooling (dev token) |
| Blocks | 05, 10, 15, 19, 37, 38 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §5.3 Key queries](../SDD.md#53-key-queries-that-encode-the-guarantees) · [SDD §3.5 State machine](../SDD.md#35-state-machine) · [SDD §6 API contract](../SDD.md#6-api-contract) · [SDD §11 Security](../SDD.md#11-security) · [SDD §16 Env](../SDD.md#16-environment-variables) · [ADR-02](../SDD.md#adr-02--http-framework-fastify-5) · [ADR-04](../SDD.md#adr-04--database-postgresql-16-neon-in-cloud--drizzle-orm) · [ADR-17](../SDD.md#adr-17--schemavalidation--ids) · [ADR-18](../SDD.md#adr-18--error-taxonomy-decides-retry-policy) |

**Status:** done

## What to build
A caller with a dev JWT can `GET /v1/videos/:id` and receive the `Video` resource from SDD §6.3 for a seeded row; without a token they get a problem+json 401; for someone else's private video, 403/404. Behind that single endpoint lands the whole persistence and HTTP foundation: `packages/config` (zod env, fail-fast), `packages/errors` (Transient/Permanent + codes), `packages/db` (Drizzle schema exactly as SDD §5.2, migration 0001, repositories with CAS transitions, fencing-token claim/complete, optimistic-lock metadata update, append-only events written in the same transaction as every transition), and the Fastify app (zod type provider, JWKS auth with dev bypass, problem+json error handler, rate limit, under-pressure, helmet/cors, `/healthz`, `/readyz` checking Postgres/Redis/S3, `/metrics` on a separate port, OpenAPI at `/docs`).

## Acceptance criteria
- [x] `pnpm db:migrate` applies 0001 to an empty DB; `drizzle-kit check` shows no drift; `pnpm db:seed` inserts a dev user + one `READY` video.
- [x] `GET /v1/videos/:id` with a minted token → 200 and the §6.3 shape (`playbackUrl` built from `CDN_BASE_URL`); no token → 401 problem+json with `code`; other owner + `private` → 404; `unlisted`/`public` → 200.
- [x] Concurrency test on real Postgres: two parallel CAS transitions `UPLOADED→PROBING` → exactly one succeeds; fenced completion with a stale token changes 0 rows and reports `fenced: true`; stale `version` on metadata update → `VERSION_CONFLICT`.
- [x] Every state transition helper writes a `video_events` row in the same transaction — there is no public API to do one without the other (test: transition then count events).
- [x] `loadEnv()` with a missing `DATABASE_URL` exits 1 listing every invalid key, secrets redacted; `.env.example` round-trips through the schema with zero unknown keys (drift guard test).
- [x] `/readyz` returns 503 when Redis is stopped and 200 when it is back; `/metrics` is served on `METRICS_PORT`, not the API port.

## Out of scope
Uploads (05), lists/PATCH (19), SSE (15), Bull Board (10).

## Notes for the implementer
- UUIDv7 generated in application code. `rendition = '-'` sentinel for non-rendition steps (part of the unique key).
- `PermanentError` must be `instanceof` BullMQ's `UnrecoverableError` so workers can throw it directly.
- Error codes are the fixed list in SDD §6.2; add none without updating the SDD.

## Testing plan
Integration tests with Testcontainers (Postgres) or compose services in CI; route tests via `app.inject()`; drift test for `.env.example`.

## Open questions
- Does the API serve the dev JWKS itself (`/.well-known/jwks.json` when `NODE_ENV=development`)? Recommended yes — decide with 03.

## Definition of Done
- [x] AC green on Node (API) and the shared packages also green under Bun; `packages/db/README` lists each repository method and the guarantee it encodes.
