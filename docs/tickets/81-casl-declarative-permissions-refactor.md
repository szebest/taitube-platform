# 81: Declarative permissions refactor with @casl/ability & elimination of ad-hoc checks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#81](https://github.com/szebest/taitube-platform/issues/81) |
| Size | M |
| Blocked by | 39 — Declarative RBAC & ABAC permission engine (can(user, action, resource)) |
| Blocks | 82 |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

## What to build

Currently, authorization, validation, and data access control across the platform suffer from three fundamental architectural problems:
1. **Imperative rule ladders:** Policies in `@vp/core/permissions` are implemented as hand-rolled, imperative `if/else` ladders for each individual action, making them difficult to maintain, compose, and audit.
2. **Fragmented, ad-hoc enforcement:** Domain services like `VideoService` (`if (user.role !== 'admin' && existing.ownerId !== user.id)`) and `UploadService` (`assertOwnership`) bypass the permission engine entirely, using duplicated, hand-written equality checks with inconsistent error structures.
3. **Manual SQL query filtering:** Repositories construct ad-hoc SQL `where` condition arrays manually (e.g. `[eq(v.visibility, 'public'), eq(v.status, 'READY'), sql\`${v.deletedAt} IS NULL\`]`), risking security leaks if a query accidentally omits soft-delete or visibility constraints.

Furthermore, as the project expands to include the React client (`apps/web`), sharing permission rules between backend and frontend requires a clean, isomorphic, zero-I/O authorization package that is decoupled from backend-specific database ports and repository interfaces.

### Architectural Solution: Full Monorepo Sweep, Adapters & Design Patterns

We will implement a clean, decoupled architecture built on Hexagonal Architecture (Ports & Adapters), Factory Methods, and Adapter Patterns. Every external or framework-specific seam is formalized as an explicit **Adapter**.

**Crucially, this ticket is not merely a library integration—it is a full-system refactor, cleanup, and integration across the WHOLE current state of the application**, completely replacing every manual permission check and ad-hoc query condition in existence, while enforcing headless UI patterns on the frontend.

```
                                  ┌───────────────────────────┐
                                  │   packages/permissions    │
                                  │   (Pure Domain Core)      │
                                  │                           │
                                  │  - getUserPermissions     │
                                  │  - typed canX helpers     │
                                  │  - assertCan guard        │
                                  └─────────────┬─────────────┘
                                                │
         ┌──────────────────────────────┬───────┴──────────────────────┬──────────────────────────────┐
         ▼                              ▼                              ▼                              ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  DrizzleScoping  │          │   FastifyAuth    │          │  ProblemDetails  │          │ ReactPermissions │
│     Adapter      │          │     Adapter      │          │   ErrorAdapter   │          │     Adapter      │
│  (Database SQL)  │          │ (HTTP Transport) │          │(Error/Validation)│          │  (Frontend UI)   │
│                  │          │                  │          │                  │          │                  │
│ - drizzleWhere   │          │ - authorize()    │          │ - assertCan()    │          │ - useCan()       │
│ - videoReadScope │          │ - preHandler     │          │ - RFC 9457 401   │          │ - TanStack hooks │
│ - notDeletedScope│          │ - req.authorize  │          │ - RFC 9457 403   │          │ - zero bloat     │
└──────────────────┘          └──────────────────┘          └──────────────────┘          └──────────────────┘
```

#### 1. Decoupled Isomorphic Package (`packages/permissions` / `@vp/permissions`)
- Create a dedicated `@vp/permissions` package under `packages/permissions/`.
- Decoupled from `@vp/core` so that both the backend (`apps/api`) and the frontend (`apps/web`) can import authorization logic without coupling the frontend bundle to server-side repository interfaces or database adapters.
- Zero framework dependencies: exclusively use pure `@casl/ability` (no `@casl/react`, `@casl/prisma`, or other framework plugins).

#### 2. Pure Functional Ability Architecture (No Classes)
- Pure functional factories only:
  - Resource rule sets split into modular definitions: `video.rules.ts`, `comment.rules.ts`, `channel.rules.ts`, `upload.rules.ts`, `admin.rules.ts`.
  - Global ability builder `getUserPermissions(user: UserContext | null)` that combines these rules into an immutable `MongoAbility`.

#### 3. Library-Agnostic `canX` Action Helper Layer
- Applications (`apps/api`, `apps/web`) must NOT consume `@casl/ability` objects or raw API methods directly.
- All in-memory permission evaluations happen through high-level, typed `canX` action helper functions:
  - `canReadVideo({ user, video })`
  - `canUpdateVideo({ user, video, fields? })`
  - `canDeleteVideo({ user, video })`
  - `canPublishVideo({ user, video })`
  - `canAccessUpload({ user, upload, video })`
  - `canDeleteComment({ user, comment, videoOwnerId? })`
  - `canPinComment({ user, videoOwnerId })`
  - `canUpdateChannel({ user, channel })`
  - `canManageCategory({ user })`

#### 4. Generalized Error & Validation Handling (`ProblemDetailsErrorAdapter`)
Authorization and validation failures must be generalized and standardized across the entire application stack:
- **Strict Distinction between 401 and 403:**
  - **401 `UNAUTHORIZED`:** Caller is unauthenticated or anonymous (`userContext === null`), requiring authentication to proceed.
  - **403 `FORBIDDEN`:** Caller is authenticated but lacks required role or resource ownership.
- **Assertion Adapter (`assertCan`):**
  - High-level assertion guard:
    ```typescript
    assertCan(allowed: boolean, options: {
      action: string;
      subject: string;
      user: UserContext | null;
      message?: string;
    }): asserts allowed
    ```
  - Automatically throws standardized RFC 9457 `PermanentError(ErrorCodes.UNAUTHORIZED)` if unauthenticated, or `PermanentError(ErrorCodes.FORBIDDEN)` with rich contextual metadata (action, subject, required capability).
- **Validation Adapter Integration:**
  - Standardized validation error adapter converting Zod schema validation errors into RFC 9457 Problem Details with structured `invalidParams: [{ name: string, reason: string }]`.

#### 5. Database Query Scoping Adapter (`DrizzleScopingAdapter` / `drizzleWhere`)
To prevent row-level security leaks in SQL queries without loading entire collections into memory, provide a declarative Drizzle query scoping adapter in `adapters/postgres/scoping/` (or `packages/db`):
- **Composable Condition Combiner (`drizzleWhere`):**
  - Adapter function `drizzleWhere(...conditions: (SQL | undefined | null | false)[])`:
    - Safely cleanses `undefined`, `null`, and boolean flags.
    - Flattens nested `and(...)` / `or(...)` conditions into a single, sanitized SQL clause.
    - Prevents empty `and()` clauses and syntax anomalies.
- **Row-Level Domain Scopes:**
  - `videoReadScope(user: UserContext | null)` generating:
    - Admin: unconditional pass (`undefined` or `sql\`1 = 1\``).
    - Authenticated User: `or(eq(videos.visibility, 'public'), eq(videos.visibility, 'unlisted'), eq(videos.ownerId, user.id))`.
    - Anonymous Guest: `eq(videos.visibility, 'public')`.
  - `videoOwnerScope(user: UserContext)`: Restricts queries strictly to `eq(videos.ownerId, user.id)`.
  - `notDeletedScope(table)`: Enforces soft-delete invariants (`sql\`${table.deletedAt} IS NULL\`` or `ne(table.status, 'DELETED')`).
- **Repository Integration:** All repository list and feed queries (`listPublic`, `listByOwner`, search queries) compose their filters using the `drizzleWhere` adapter instead of manual array mutation.

#### 6. HTTP Transport Authorization Adapter (`FastifyAuthorizationAdapter`)
- In `apps/api/src/plugins/authorization.ts`: Adapts HTTP route handling by providing `server.authorize(canXHelper, resolver)` and `request.authorize(canXHelper, resource)`.
- Eliminates inline authorization code in route adapters, maintaining thin transport discipline.

#### 7. Frontend Reactive State Adapter (`ReactPermissionsAdapter`) & Headless UI Enforcement
- In `apps/web`: Pure functional React hook `useCan(canXHelper, params)` that reactively evaluates permissions against the current session without external framework dependencies (`@casl/react`).
- **Strict Headless Rule:** Embedding complex logic, permission calculations, or inline authorization decisions directly inside UI components is a **STRICT ARCHITECTURAL VIOLATION**. All components must consume headless hooks (`useCan`, TanStack Query hooks).

#### 8. Complete Monorepo Refactor & Current State Migration
- Every existing service in `apps/api/src/services/` (`VideoService`, `UploadService`, `ChannelService`, `SubscriptionService`, `ReactionService`, etc.) refactored to replace ad-hoc `if (user.id !== ownerId)` with `assertCan(...)`.
- Every existing route in `apps/api/src/routes/` verified to delegate through dedicated domain services and authorization preHandlers.
- All repository queries in `adapters/postgres/repositories/` and in-memory test doubles refactored to use `drizzleWhere` and query scopes.

## Acceptance criteria

- [x] **Decoupled Package (`packages/permissions`):**
  - Configured as `@vp/permissions` in `packages/permissions/package.json` with workspace references.
  - Depends only on `@casl/ability` and `@vp/errors`.
  - Zero I/O and zero Node-specific runtime bindings (100% dual-runtime compatible with Node 24 and Bun 1.4).
- [x] **Pure Functional Ability Builders:**
  - Resource rules partitioned into modular files (`video.rules.ts`, `comment.rules.ts`, `channel.rules.ts`, `upload.rules.ts`, `admin.rules.ts`).
  - Global builder `getUserPermissions(user: UserContext | null)` compiles the unified ability without class inheritance.
- [x] **Library-Agnostic `canX` Helper API:**
  - Fully typed helper functions for all domain actions (`canReadVideo`, `canUpdateVideo`, `canDeleteVideo`, `canPublishVideo`, `canAccessUpload`, `canDeleteComment`, `canPinComment`, `canUpdateChannel`, `canManageCategory`).
- [x] **Generalized Error & Validation Adapter (`ProblemDetailsErrorAdapter`):**
  - `assertCan(allowed, { action, subject, user, message })` guard throwing RFC 9457 `UNAUTHORIZED` (401) or `FORBIDDEN` (403) with structured error context.
  - Generalized validation error handling formatting Zod failures into RFC 9457 `VALIDATION_FAILED` with `invalidParams`.
- [x] **Database Query Scoping Adapter (`DrizzleScopingAdapter` / `drizzleWhere`):**
  - Composable condition combiner `drizzleWhere(...conditions)` sanitizing and composing `and(...)` clauses.
  - Pre-defined row-level authorization scopes (`videoReadScope`, `videoOwnerScope`, `notDeletedScope`).
  - Repositories (`PostgresVideoRepository.listPublic`, `listByOwner`) refactored to use `drizzleWhere` and query scopes, eliminating manual condition array pushing.
- [x] **HTTP Transport Authorization Adapter (`FastifyAuthorizationAdapter`):**
  - Fastify decorator and preHandler adapter seamlessly bridging route schemas and `canX` helpers.
- [x] **Frontend Reactive Adapter (`ReactPermissionsAdapter`):**
  - Lightweight `useCan` hook in `apps/web` consuming typed helpers with zero framework bloat.
  - Strict headless UI rule enforced: zero inline permission calculations in UI components.
- [x] **Full Monorepo State Migration & Cleanup:**
  - `VideoService`: replace manual `user.role !== 'admin' && existing.ownerId !== user.id` with `assertCan(canUpdateVideo(...))` and `assertCan(canDeleteVideo(...))`.
  - `UploadService`: replace private `assertOwnership` with `assertCan(canAccessUpload(...))`.
  - All existing route handlers, services, and repositories across `apps/api` and `adapters/` fully migrated to `@vp/permissions` and `drizzleWhere`. Zero unadapted legacy checks remaining.
- [x] **Governance & Documentation:**
  - Rules 13 and 14 maintained in `AGENTS.md` strictly forbidding manual hand-written permission checks and complex logic in components.
  - Update `docs/SDD.md` §11 (Security / Authorization) to document the adapter architecture, `@casl/ability` functional core, and `drizzleWhere` query scoping.
  - Re-run `python3 docs/tickets/gen-index.py` to keep the ticket index synchronized.

## Out of scope

- `@casl/react` or UI framework integrations (React client will use the pure `canX` helper functions directly via `useCan`).
- Automated general-purpose AST compiler from CASL rules into SQL (domain scopes remain clean, explicit Drizzle SQL builders via `drizzleWhere`).

## Testing plan

- **Unit tests:** Matrix tests in `packages/permissions` covering all action x role x ownership permutations (GUEST, USER, CREATOR, MODERATOR, ADMIN).
- **Error Adapter tests:** Test `assertCan` asserting 401 when user is anonymous, 403 with structured RFC 9457 details when authenticated user is forbidden.
- **Query Scoper tests:** Test `drizzleWhere` condition combiner with varied inputs (null, undefined, false, active SQL) and query scopes (`videoReadScope`, `notDeletedScope`).
- **Service integration tests:** Verify that `VideoService` and `UploadService` throw RFC 9457 `FORBIDDEN` (403) when invoked by non-owners and succeed when authorized.
- **Dual-runtime tests:** Run under `vitest` and `bun test`.

## Definition of Done

- [x] All ACs satisfied with verifiable test output.
- [x] Complete full-system refactoring across all existing services, routes, and repositories (zero legacy ad-hoc checks remaining).
- [x] `pnpm test`, `bun test`, `pnpm typecheck`, and `pnpm lint` pass with zero warnings or errors.
- [x] Rules 13 and 14 maintained in `AGENTS.md` and SDD §11 updated.
- [x] Ticket status updated and `python3 docs/tickets/gen-index.py` re-run.
