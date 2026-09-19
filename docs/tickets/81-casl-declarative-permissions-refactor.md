# 81: Declarative permissions refactor with @casl/ability & elimination of ad-hoc checks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#81](https://github.com/szebest/taitube-platform/issues/81) |
| Size | M |
| Blocked by | 39 — Declarative RBAC & ABAC permission engine (can(user, action, resource)) |
| Blocks | — |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** ready

## What to build

Currently, authorization across the platform suffers from two fundamental architectural problems:
1. **Imperative rule ladders:** Policies in `@vp/core/permissions` are implemented as hand-rolled, imperative `if/else` ladders for each individual action, making them difficult to maintain, compose, and extend.
2. **Fragmented, ad-hoc enforcement:** Domain services like `VideoService` (`if (user.role !== 'admin' && existing.ownerId !== user.id)`) and `UploadService` (`assertOwnership`) bypass the permission engine entirely, using duplicated, hand-written equality checks.

Furthermore, as the project expands to include the React client (`apps/web`), sharing permission rules between backend and frontend requires a clean, isomorphic, zero-I/O authorization package that is decoupled from backend-specific database ports and repository interfaces.

### Architectural Solution: `@casl/ability` Functional Engine

We will build a declarative, type-safe authorization layer using `@casl/ability`:
1. **Package Placement (`packages/permissions`):**
   - Create a dedicated `@vp/permissions` package under `packages/permissions/`.
   - Decoupled from `@vp/core` so that both the backend (`apps/api`) and the frontend (`apps/web`) can import authorization logic without coupling the frontend bundle to server-side repository interfaces or DB types.
   - Zero framework dependencies: exclusively use pure `@casl/ability` (no `@casl/react`, `@casl/prisma`, or other framework plugins).
2. **Functional Architecture (No Classes):**
   - Pure functional factories only:
     - Resource rule sets split into modular definitions: `video.rules.ts`, `comment.rules.ts`, `channel.rules.ts`, `upload.rules.ts`, `admin.rules.ts`.
     - Global ability builder `getUserPermissions(user: UserContext | null)` (or `buildUserAbility`) that combines these rules into an immutable `MongoAbility`.
3. **Library-Agnostic `canX` Action Helper Layer:**
   - Applications (`apps/api`, `apps/web`) must NOT consume `@casl/ability` objects or API methods directly.
   - Instead, all consumption happens through high-level, typed `canX` action helper functions:
     - `canReadVideo({ user, video })`
     - `canUpdateVideo({ user, video, fields? })`
     - `canDeleteVideo({ user, video })`
     - `canPublishVideo({ user, video })`
     - `canAccessUpload({ user, upload, video })`
     - `canDeleteComment({ user, comment, videoOwnerId? })`
     - `canPinComment({ user, videoOwnerId })`
     - `canUpdateChannel({ user, channel })`
     - `canManageCategory({ user })`
   - Typed assertion helper: `assertCan(allowed: boolean, message?: string)` that throws RFC 9457 `PermanentError(ErrorCodes.FORBIDDEN)`.
4. **Complete Elimination of Manual Checks:**
   - Strictly FORBID manual hand-checks of user IDs, roles, or ownership (`if (user.id !== ownerId)`) in any service, route, or repository.
   - Refactor `VideoService`, `UploadService`, and route handlers to systematically enforce authorization through `assertCan(canX(...))`.
   - Update Fastify authorization decorators to align with the new helper layer.

## Acceptance criteria

- [ ] **Decoupled Package (`packages/permissions`):**
  - Configured as `@vp/permissions` in `packages/permissions/package.json` with workspace references.
  - Depends only on `@casl/ability` and `@vp/errors`.
  - Zero I/O and zero Node-specific runtime bindings (100% dual-runtime compatible with Node 24 and Bun 1.4).
- [ ] **Pure Functional Ability Builders:**
  - Resource rules partitioned into modular files (`video.rules.ts`, `comment.rules.ts`, `channel.rules.ts`, `upload.rules.ts`, `admin.rules.ts`).
  - Global builder `getUserPermissions(user: UserContext | null)` compiles the unified ability without class inheritance.
- [ ] **Library-Agnostic `canX` Helper API:**
  - Fully typed helper functions for all domain actions (`canReadVideo`, `canUpdateVideo`, `canDeleteVideo`, `canPublishVideo`, `canAccessUpload`, `canDeleteComment`, `canPinComment`, `canUpdateChannel`, `canManageCategory`).
  - `assertCan(condition, message)` utility throwing `PermanentError(ErrorCodes.FORBIDDEN)`.
- [ ] **Elimination of Hand-Written Permission Checks:**
  - `VideoService`: replace manual `user.role !== 'admin' && existing.ownerId !== user.id` with `assertCan(canUpdateVideo(...))` and `assertCan(canDeleteVideo(...))`.
  - `UploadService`: replace private `assertOwnership` with `assertCan(canAccessUpload(...))`.
  - All route handlers and services across `apps/api` delegate access control exclusively to `@vp/permissions`.
- [ ] **Governance & Documentation:**
  - Add Rule 13 to `AGENTS.md` strictly forbidding manual hand-written permission checks in any service, route, or repository.
  - Update `docs/SDD.md` §11 (Security / Authorization) to document the `@casl/ability` functional architecture and `packages/permissions`.
  - Re-run `python3 docs/tickets/gen-index.py` to keep the ticket index synchronized.

## Out of scope

- `@casl/react` or UI framework integrations (React client will use the pure `canX` helper functions directly).
- Database SQL query translation (`@casl/drizzle`) — SQL query filters for feeds remain explicit in repository queries.

## Testing plan

- **Unit tests:** Matrix tests in `packages/permissions` covering all action x role x ownership permutations (GUEST, USER, CREATOR, MODERATOR, ADMIN).
- **Service integration tests:** Verify that `VideoService` and `UploadService` throw RFC 9457 `FORBIDDEN` (403) when invoked by non-owners and succeed when authorized.
- **Dual-runtime tests:** Run under `vitest` and `bun test`.

## Definition of Done

- [ ] All ACs satisfied with verifiable test output.
- [ ] `pnpm test`, `bun test`, `pnpm typecheck`, and `pnpm lint` pass with zero warnings or errors.
- [ ] Rule 13 added to `AGENTS.md` and SDD §11 updated.
- [ ] Ticket status updated and `python3 docs/tickets/gen-index.py` re-run.
