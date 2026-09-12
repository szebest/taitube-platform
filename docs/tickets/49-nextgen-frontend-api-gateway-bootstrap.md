# 49: Next-Gen frontend direct API gateway & CORS profile for Taitube

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 36 — Public feed · 38 — User identity · 45 — Frontend API modernization · 46 — YouTube playlists · 47 — Multi-resource search |
| Blocks | 52 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

## What to build

With all foundational creator, engagement, search, playlist, and identity services in place, this ticket ties together the modern frontend client developer experience. 

It provides:
1. **Frontend-Optimized Gateway Profiles & CORS**:
   - Explicit CORS headers tuned for development (http://localhost:3000, http://localhost:5173) and production web/mobile clients.
   - Pre-flight caching (Access-Control-Max-Age: 86400) to eliminate unnecessary OPTIONS overhead on high-traffic endpoints.
2. **Batch & Composite Endpoints**:
   - GET /v1/bootstrap: Returns initial app context for the frontend in a single round-trip (authenticated user profile, active categories, unread notifications count, feature flags). Drastically improves initial First Contentful Paint (FCP).
3. **Frontend Mock & Contract Test Suite**:
   - Automated contract test validating the API contract directly against szebest/youtube-frontend API service clients.

## Acceptance criteria

- [ ] CORS configuration plugin in apps/api/src/plugins/cors.ts supporting configurable origins via CORS_ALLOWED_ORIGINS env var, with safe local defaults.
- [ ] GET /v1/bootstrap:
  - Publicly accessible; enriches with user session if Authorization header present.
  - Returns { user: ChannelProfile | null, categories: Category[], featureFlags: Record<string, boolean> }.
  - p95 response time under 30ms locally.
- [ ] Contract validation suite tests/contract/frontend-parity.test.ts asserting all response payloads conform strictly to TypeScript definitions required by Taitube frontend.

## Out of scope

- Direct code commits to external youtube-frontend repository.

## Notes for the implementer

- Ensure all response objects include camelCase JSON serialization matching frontend conventions.
- Maintain <= 250 lines rule for all handlers and plugins.

## Testing plan

- Integration tests for GET /v1/bootstrap (both anonymous and authenticated).
- Preflight CORS header verification test via app.inject().

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
