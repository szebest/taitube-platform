# 45: Frontend API modernization & contract alignment — migrate web app to clean canonical `/v1` APIs

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 37 — Admin category · 38 — User identity · 39 — Declarative RBAC · 40 — Reactions · 41 — Subscriptions · 42 — Threaded comments · 43 — Views buffer · 44 — Creator studio |
| Blocks | 49, 52 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

## What to build

### Architectural Decision: Clean Modern Backend vs Legacy Backend Shims

| Strategy | Architecture Purity | Long-term Maintainability | Technical Debt | Verdict |
|---|---|---|---|---|
| **Legacy Adapter Layer (`apps/api/src/legacy/`)** | Pollutes clean backend with deprecated endpoints (`/videos/upload`, `/account/profile/details`), ad-hoc DTO mappers, and dual maintenance overhead | High maintenance: every new feature requires double mapping; leaky abstractions | Severe: backend becomes shackled to legacy frontend anti-patterns | **Rejected** |
| **Frontend API Modernization (Migrate FE to clean `/v1`)** | Backend remains 100% clean, idiomatic, single-sourced, and OpenAPI 3.1 compliant. Frontend is upgraded to consume the superior, modern backend API architecture | Exceptional: frontend codebase is modernized to modern REST/JSON standards with zero legacy baggage on the server | Zero: backend stays pristine | **Accepted (Recommended)** |

The backend in this repository is architecturally superior to the legacy API: it features strict RFC 9457 Problem Details errors, deterministic UUIDv7 identifiers, cursor/keyset pagination, CAS state fencing, and single-sourced Zod OpenAPI DTO contracts. **We do not adapt the modern backend to the old frontend; we modernize the frontend to consume the clean, canonical `/v1` backend APIs.**

This ticket refactors the frontend's API communication layer to natively speak the canonical `/v1` contract:

1. **Upload Flow Modernization**:
   - Replaces legacy multi-step upload with canonical v1 direct-to-S3 presigned PUT flow:
     - Calls `POST /v1/videos` to create video metadata and obtain presigned upload URL.
     - Uploads directly to S3/MinIO via HTTP PUT with progress tracking.
     - Calls `POST /v1/videos/:id/complete` to verify object and trigger background processing.
2. **Video Playback & Metadata**:
   - Replaces `/videos/:id/details` & `/videos/:id/info` with `GET /v1/videos/:id`.
   - Consumes canonical `VideoDto` (title, description, duration, ladder, HLS master playlist URL, views count, channel identity).
3. **User Identity & Channel Profiles**:
   - Replaces `/account/details` with `GET /v1/me/account`.
   - Replaces `/account/profile/details/:userId` with `GET /v1/channels/:idOrHandle`.
4. **Engagement & Social Interactions**:
   - Replaces `/videos/:id/like` with `PUT /v1/videos/:id/reactions` (`LIKE` / `DISLIKE` / `NONE`).
   - Replaces `/subscriptions/user/:userId/subscribe` with `POST /v1/channels/:id/subscribe` and `DELETE /v1/channels/:id/subscribe`.
   - Replaces `/videos/subscriptions` with `GET /v1/feed/subscriptions`.
5. **Threaded Comments & Keyset Pagination**:
   - Replaces offset-based `/videos/:id/comments` with keyset-paginated `GET /v1/videos/:id/comments?cursor=...&limit=...`.
   - Upgrades comment creation, updates, and replies to `POST /v1/videos/:id/comments` (with parentId for nested replies).

## Acceptance criteria

- [ ] Zero legacy compatibility routes introduced in `apps/api`: backend routes remain strictly under canonical `/v1/*`.
- [ ] Frontend API services refactored to consume `/v1/*` endpoints:
  - Video upload uses `POST /v1/videos` -> direct S3 PUT -> `POST /v1/videos/:id/complete`.
  - Watch page consumes `GET /v1/videos/:id` with HLS master playback URL.
  - Channel profile consumes `GET /v1/channels/:idOrHandle`.
  - Reactions use `PUT /v1/videos/:id/reactions` with atomic optimistic updates.
  - Subscriptions use `POST/DELETE /v1/channels/:id/subscribe`.
  - Comments use `GET /v1/videos/:id/comments` with cursor-based pagination.
- [ ] All request payloads and query parameters align strictly with `@taitube/api-contracts` (Ticket 50).
- [ ] Frontend handles RFC 9457 `application/problem+json` error structures natively (parsing `title`, `detail`, and machine-readable `code`).
- [ ] Integration tests in `apps/web` verifying frontend API modules communicate cleanly with `/v1` mock endpoints without regression.

## Out of scope

- Direct database schema changes (covered in tickets 38–44).
- UI visual redesign (covered in tickets 55, 58, 59).

## Notes for the implementer

- By upgrading the frontend to `/v1`, we keep `apps/api` lean, eliminating unnecessary adapter middleware, serialization overhead, and duplicate routes.
- Use `@taitube/api-contracts` DTO types directly in frontend API call signatures to guarantee 100% compile-time type safety.

## Testing plan

- Integration test: Mock Fastify `/v1` server responses using MSW; execute frontend data-fetching methods; assert exact payload parsing and state updates.
- End-to-end smoke test: Frontend successfully executes full upload, watch, like, subscribe, and comment loop against local `/v1` API.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [ ] Backend routes remain 100% clean with zero legacy shims.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
