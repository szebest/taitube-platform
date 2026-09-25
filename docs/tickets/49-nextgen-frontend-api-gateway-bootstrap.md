# 49: Next-Gen frontend direct API gateway & CORS profile for Taitube

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#49](https://github.com/szebest/taitube-platform/issues/49) |
| Size | M |
| Blocked by | 36 - Public feed · 37 - Admin categories · 38 - User identity |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** done

Backend only. The frontend lives in this repo and its types come from `@vp/api-contracts`, so the contract is
compile-checked already; no parity suite against an external frontend.

## What to build

1. **CORS origins for the web app.** `@fastify/cors` is already registered in `apps/api/src/app.ts` from
   `config.http.corsOrigins` (`CORS_ORIGINS`). Make sure the local defaults and `.env.example` include the
   Vite dev server and the origin the built TanStack Start server ([89](89-web-tanstack-start-foundation.md))
   serves from, and set `Access-Control-Max-Age` so browsers cache preflights.
2. **`GET /v1/bootstrap`.** Initial app context in one round trip: `{ user: ChannelProfile | null,
   categories: Category[], featureFlags: Record<string, boolean> }`. Public; enriched with the user when a
   valid `Authorization` header is present. Contract in `@vp/api-contracts`, so the web root loader can call it
   through `apiClient`.

## Acceptance criteria

- [x] Default `CORS_ORIGINS` and `.env.example` cover the Vite dev server and the local SSR server origin;
      production still refuses empty or `*`.
- [x] Preflight response carries `Access-Control-Max-Age`.
- [x] `GET /v1/bootstrap` returns the shape above for anonymous and authenticated callers, declared in
      `@vp/api-contracts`; p95 under 30 ms locally.

## Testing plan

- Integration tests for `GET /v1/bootstrap`, anonymous and authenticated.
- Preflight header test through `app.inject()` for an allowed and a refused origin.

## Open questions

- Decided: the built TanStack Start server is expected on `http://localhost:4173`, Vite's preview port, because
  the API holds 3000. [89](89-web-tanstack-start-foundation.md) serves `start` there, or changes the default
  in `@vp/env-schema`, `.env.example`, the k8s base and SDD §16.1 together.
- Decided: `featureFlags` comes from a new `FEATURE_FLAGS` key, a comma list of enabled names, each reported
  as `true`; nothing else in the repo holds flags yet. Empty by default.
- Decided: an authenticated caller whose account read fails gets that failure (401 or 404), not a guest
  context, and an invalid bearer is a 401 like on every other anonymous-allowed route.
- Decided: the CORS profile sends no `Access-Control-Allow-Credentials`. [56](56-frontend-universal-auth-session-security.md)
  still owns the choice between a same-origin proxy and credentialed CORS; either one works from here.

## Definition of Done

- [x] All ACs green under `pnpm test` and `pnpm test:bun`.
- [x] `pnpm typecheck && pnpm lint` pass.
- [x] `docs/SDD.md` §6.1 lists `/v1/bootstrap`.
- [x] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
