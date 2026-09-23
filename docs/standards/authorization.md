# Declarative Authorization & Permissions Standards

This document specifies the declarative RBAC & ABAC permission engine architecture for the `video-pipeline` monorepo.

---

## 1. Non-Negotiable Rule: Zero Hand-Checked Permissions

Manual hand-checking of user IDs, roles, or ownership is strictly forbidden:

```typescript
// ❌ STRICT ARCHITECTURAL VIOLATION: Hand-checked permissions
if (user.role !== 'admin' && video.userId !== user.id) {
  throw new ForbiddenError();
}
```

Instead, all authorization decisions must be evaluated declaratively through `@vp/permissions`, and
the verdict is **returned**, never thrown (ADR-24). `authorize` in `@vp/domain-rules` owns the
401-vs-403 distinction, so no rule collapses a missing token into a refusal the caller cannot act on:

```typescript
// ✅ CORRECT: a pure ability answers the verdict, the rule returns the refusal
export function decideVideoMetadataUpdate(
  input: UpdateVideoMetadataInput
): Result<VideoMetadataPatch, UpdateVideoMetadataFailure> {
  if (!canUpdateVideo({ user: input.editor, video: readable.value, fields })) {
    return err(videoEditForbidden(input.videoId));
  }
  return map(validateVideoMetadata(input.patch), () => input.patch);
}
```

`assertCan` is still exported from `@vp/permissions` for `apps/web`, whose provider builds
`usePermissions().assertCan` on it. It has no place in a rule, a service or a route.

---

## 2. Decoupled Functional Core (`@vp/permissions`)

The permission engine is a pure domain package (`packages/universal/permissions`) with zero framework or I/O runtime dependencies, 100% dual-runtime compatible (Node 24 and Bun 1.4).

### Strict Typing & Boundary Role Parsing
- **`Role`**: Strictly typed union `'GUEST' | 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN'`. Zero `any`, zero loose string fallbacks.
- **`UserContext`**: `{ readonly id: string; readonly role: Role; readonly email?: string; }`.
- **`parseRole(value: unknown): Role`**: Sanitizes external JWT/HTTP inputs at the boundary. Internal domain code never uses defensive role fallbacks.

### Pure Functional Ability Builders
- Rules are partitioned into modular definitions:
  - `rules/video.rules.ts`: Video read, create, update, delete, publish, react.
  - `rules/comment.rules.ts`: Comment create, delete (author + video owner), pin.
  - `rules/channel.rules.ts`: Channel update and management.
  - `rules/upload.rules.ts`: Upload access and ingestion lifecycle.
  - `rules/admin.rules.ts`: Superuser global bypass (`can('manage', 'all')`).
- Global builder `getUserPermissions(user: UserContext | null): AppAbility` compiles rules into an immutable `MongoAbility` with zero class inheritance.

### Resource Normalizers (`packages/universal/permissions/src/normalizers/`)
Centralized normalizers eliminate ad-hoc object spreads and provide canonical CASL subject wrappers:
- `video.normalizer.ts`: Maps `ownerId ?? userId`, defaults `visibility ?? 'public'`.
- `channel.normalizer.ts`: Maps `ownerId ?? userId`.
- `comment.normalizer.ts`: Maps `authorId ?? userId` and resolves `videoOwnerId`.
- `upload.normalizer.ts`: Maps `ownerId` across upload and video fallbacks.
- `subject-wrapper.ts`: Type-safe CASL `subject(name, normalized)` builders.
- Every normalizer maps 1:1 to a dedicated test file in `__tests__/`.

---

## 3. Hexagonal Adapter Seams

```
                                  ┌───────────────────────────┐
                                  │   packages/universal/permissions    │
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
│  Postgres Scopes │          │   CaslAuthz      │          │  ProblemDetails  │          │ ReactPermissions │
│     Adapter      │          │     Adapter      │          │   ErrorAdapter   │          │     Adapter      │
│  (Database SQL)  │          │ (Domain Services)│          │(Error/Validation)│          │  (Frontend UI)   │
│                  │          │                  │          │                  │          │                  │
│ - rulesToSql     │          │ - can()          │          │ - assertCan()    │          │ - useCan()       │
│ - drizzleWhere   │          │ - forUser()      │          │ - RFC 9457 401   │          │ - PermissionsCtx │
│ - accessibleBy   │          │ - memoized       │          │ - RFC 9457 403   │          │ - <Can /> slot   │
│ - notDeletedScope│          │                  │          │ - invalidParams  │          │ - zero bloat     │
└──────────────────┘          └──────────────────┘          └──────────────────┘          └──────────────────┘
```

### 1. Database Query Scoping Adapter (`packages/server/adapters/postgres/scopes/`)
Row-level database security is decoupled into single-responsibility modules:
- `traits.ts`: Schema trait interfaces constraining the tables a scope accepts (`WithOwner`, `WithVisibility`, `SoftDeletable`).
- `rules-to-sql.ts`: Compiles CASL rules to Drizzle SQL via `@casl/ability/extra` `rulesToAST`.
- `where.ts`: `drizzleWhere(...conditions)` cleanses `undefined`/`null`/`false` and combines the rest into `and(...)`.
- `accessible-by.ts`: `accessibleBy` plus the bound scopes `videoReadScope`, `ownerScope`, `publicVisibilityScope`.
- `soft-delete.ts`: Generic `notDeletedScope<TTable extends SoftDeletable>(table: TTable)` soft-delete safety scope.

Every scope reaches SQL through one chain, so no query can be scoped by logic that
disagrees with the rules: `repository -> videoReadScope -> accessibleBy -> rulesToSql`.

#### The compiler has three outcomes, and they are not interchangeable
`rulesToSql(action, subject, viewer, table)` returns:

| Rules say | Returns | Meaning |
| --- | --- | --- |
| Granted unconditionally | `undefined` | No restriction; the caller adds no clause |
| Granted with conditions | An `SQL` condition | Restrict to the matching rows |
| Not granted at all | ``sql`false` `` | Match no rows |

`rulesToAST` returns `null` for the third case. Mapping that to `undefined` alongside the
first case turns a denied action into an unfiltered query, which is why the two are kept
apart. A condition naming a column the table does not have throws rather than being
skipped, because dropping a term from an `and` widens it into an unintended grant.

#### Feed policy is not authorization
`publicVisibilityScope` exists because "what a viewer may read" and "what a listing shows"
are different questions. Unlisted videos are readable by link and must never appear in a
feed, so `listPublic` states that policy directly instead of borrowing the guest read scope.

### 1a. Row Mapping (`packages/server/adapters/postgres/mappers/`)
Writes go through mappers that declare the Drizzle row type as their return type
(`toRenditionInsert`, `toRenditionUpdate`, `toUploadInsert`, `toUploadStatusUpdate`). The
return type is what forces the mapping to stay complete, so a renamed or retyped column
fails at compile time. Reads take no mapper: row and record are structurally identical and
the compiler proves it, so an identity function would only create a place for them to
drift. `toOutboxRecord` is the exception, confining the one assertion that jsonb requires.

### 2. Dependency Inversion in Domain Services (`AuthorizationPort`)
Domain services depend on the abstract port `AuthorizationPort` (`packages/server/core/ports/authorization.port.ts`).
- Concrete implementation: `CaslAuthorizationAdapter` (`packages/server/adapters/authorization/casl-authorization-adapter.ts`).
- Holds memoized `AppAbility`, implements `can(action, subject)` and `.forUser(user)`. It answers the
  verdict only: the refusal belongs to `authorize(actor, allowed, context)` in `@vp/domain-rules` (ADR-24).
- Test doubles: `PermissiveAuthorizationAdapter` and `StrictAuthorizationAdapter` in `packages/server/adapters/in-memory/`.

### 3. HTTP Transport Carries Identity, Not Permissions
`apps/api` has no Fastify authorization decorator. Routes resolve **who** the caller is and hand that to a
domain service, which makes the decision through `AuthorizationPort`:
- `plugins/auth.ts` populates `request.user` from a Bearer JWT the `TokenVerifier` port accepts, or, in dev
  mode only, a valid `x-admin-token`. A token it refuses answers a 401 problem from the hook itself.
- `requireAuth(request)` throws RFC 9457 `401 UNAUTHORIZED` when an endpoint needs a caller and there is none.
- `decideAdminAccess` in `@vp/domain-rules` holds the one admin gate; operator services compose it with
  the resolved caller.
- `sendResult` renders the returned `UNAUTHORIZED` as `401` and `FORBIDDEN` as `403`. The global error
  handler is a backstop for transport failures and auth pre-handler rejections, not for a rule's verdict.

### 4. Frontend Reactive State (`ReactPermissionsAdapter`) & Headless UI
In `apps/web`:
- `PermissionsProvider` (`apps/web/src/modules/shared/providers/permissions-provider.tsx`): Computes and memoizes `getUserPermissions(userContext)`.
- `usePermissions()`: Context hook exposing `{ ability, can, cannot, assertCan }`.
- `useCan(action, subject)`: O(1) declarative permission hook with zero rule re-evaluations.
- `<Can do={action} on={subject} fallback={<Fallback />}>{children}</Can>`: Headless UI slot component adhering to Rule 14.
