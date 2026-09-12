# 38: User & channel identity profile with universal OIDC/JWKS provider

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#38](https://github.com/szebest/taitube-platform/issues/38) |
| Size | L |
| Blocked by | 04 — API skeleton + auth + schema |
| Blocks | 39, 40, 41, 42, 43, 44, 45, 46, 47, 49, 50, 56, 72, 76, 77, 78 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready

## What to build

The original frontend relied on a flawed, Facebook-only authentication strategy and had no persistent database-backed user profile or channel identity. 

This ticket implements:
1. **Universal OIDC / JWKS authentication compatibility**:
   - Supports production-ready third-party identity providers (e.g. Clerk, Supabase Auth, Auth0, Keycloak) or self-hosted OIDC instances via standard JWKS verification.
   - Retains dev-token bypass for offline local development and automated CI testing.
2. **Channel & User Profile Entity**:
   - Every user has a canonical channel identity: unique handle (e.g. @johndoe), display name, avatar URL, banner URL, bio / description, and subscriber count.
   - Auto-provisions a default channel upon first authenticated request (JIT provisioning).
3. **Clean, RESTful Identity & Channel Endpoints**:
   - `GET /v1/me/account` (returns authenticated user profile, email, and associated channel data).
   - `PATCH /v1/me/channel` (updates display name, handle, avatar URL, banner URL, bio).
   - `GET /v1/channels/:idOrHandle` (public creator channel profile by UUID or lowercase `@handle`).
4. Strict modular repository structure conforming to <= 250 lines rule.

## Acceptance criteria

- [ ] Database migration extending/creating channels and users:
  - channels table: id UUIDv7 PK, user_id UUID FK to users.id unique, handle text unique lowercase, display_name text not null, avatar_url text, banner_url text, bio text, subscriber_count integer not null default 0, created_at, updated_at.
  - Indexes on channels.handle and channels.user_id.
- [ ] JIT (Just-In-Time) user & channel provisioning hook in Fastify auth middleware: if a verified JWT contains subject sub not yet in DB, inserts user and default channel with handle derived from email/sub.
- [ ] Domain entity Channel and ChannelRepositoryPort defined in @taitube/core.
- [ ] PostgresChannelRepository in adapters/postgres/repositories/postgres-channel-repository.ts (<= 250 lines).
- [ ] InMemoryChannelRepository in adapters/in-memory/repositories/in-memory-channel-repository.ts.
- [ ] API Endpoints:
  - `GET /v1/me/account`: Returns authenticated user info and associated channel profile.
  - `PATCH /v1/me/channel`: Updates channel info with validation (handle format: `^[a-zA-Z0-9_.-]{3,30}$`). Handles handle conflict with 409 HANDLE_ALREADY_EXISTS.
  - `GET /v1/channels/:idOrHandle`: Public endpoint returning public channel details, subscriber count, and avatar/banner.
- [ ] Unit & integration tests via app.inject() verifying JIT provisioning, profile update, handle uniqueness check, and unauthenticated public channel retrieval.
- [ ] OpenAPI 3.1 documentation for all user/channel endpoints.

## Out of scope

- Direct file upload for avatars/banners (presigned URLs handled separately or via external URLs).
- Following/subscriptions logic (handled in ticket 41).

## Notes for the implementer

- **Handle sanitization:** Force lowercase handles and disallow reserved handles (e.g., admin, api, system, studio).
- **File length limit:** Ensure postgres-channel-repository.ts stays under 250 lines. Keep user queries in postgres-user-repository.ts.
- **Errors:** Throw PermanentError with RFC 9457 codes: CHANNEL_NOT_FOUND, HANDLE_ALREADY_TAKEN, INVALID_HANDLE_FORMAT.

## Testing plan

- Unit tests for handle validation regex and channel model.
- Integration tests for GET /v1/account/details with fresh JWT (verifying JIT creation).
- Conflict test for updating to an existing handle.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
