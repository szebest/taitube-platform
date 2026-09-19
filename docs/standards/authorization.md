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

Instead, all authorization decisions must be evaluated declaratively through `@vp/permissions`:

```typescript
// ✅ CORRECT: Declarative evaluation via pure ability engine & assertion guard
assertCan(canUpdateVideo({ user, video }), {
  action: 'update',
  subject: 'Video',
  user,
});
```

---

## 2. Decoupled Functional Core (`@vp/permissions`)

The permission engine is a pure domain package (`packages/permissions`) with zero framework or I/O runtime dependencies, 100% dual-runtime compatible (Node 24 and Bun 1.4).

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

### Resource Normalizers (`packages/permissions/src/normalizers/`)
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
│  Postgres Scopes │          │   FastifyAuth    │          │  ProblemDetails  │          │ ReactPermissions │
│     Adapter      │          │     Adapter      │          │   ErrorAdapter   │          │     Adapter      │
│  (Database SQL)  │          │ (HTTP Transport) │          │(Error/Validation)│          │  (Frontend UI)   │
│                  │          │                  │          │                  │          │                  │
│ - rulesToSql     │          │ - authorize()    │          │ - assertCan()    │          │ - useCan()       │
│ - drizzleWhere   │          │ - preHandler     │          │ - RFC 9457 401   │          │ - PermissionsCtx │
│ - accessibleBy   │          │ - req.ability    │          │ - RFC 9457 403   │          │ - <Can /> slot   │
│ - notDeletedScope│          │ - req.can / assert│         │ - invalidParams  │          │ - zero bloat     │
└──────────────────┘          └──────────────────┘          └──────────────────┘          └──────────────────┘
```

### 1. Database Query Scoping Adapter (`adapters/postgres/scopes/`)
Row-level database security is decoupled into single-responsibility modules:
- `traits.ts`: Generalized schema trait interfaces (`WithOwner`, `WithVisibility`, `SoftDeletable`, `OwnableAndVisible`).
- `rules-to-sql.ts`: Compiles CASL rules directly to Drizzle SQL via `@casl/ability/extra` `rulesToAST`.
- `where.ts`: `drizzleWhere(...conditions)` safely cleanses `undefined`/`null`/`false` and combines active conditions into `and(...)`.
- `accessible-by.ts`: CASL database adapter providing `accessibleBy`, `accessibleVideos`, `videoReadScope`, `videoOwnerScope`.
- `soft-delete.ts`: Generic `notDeletedScope<TTable extends SoftDeletable>(table: TTable)` soft-delete safety scope.

### 2. Dependency Inversion in Domain Services (`AuthorizationPort`)
Domain services depend on the abstract port `AuthorizationPort` (`core/ports/authorization.port.ts`).
- Concrete implementation: `CaslAuthorizationAdapter` (`adapters/authorization/casl-authorization-adapter.ts`).
- Holds memoized `AppAbility`, implements `can(action, subject)`, `assertCan(...)`, and `.forUser(user)`.
- Test doubles: `PermissiveAuthorizationAdapter` and `StrictAuthorizationAdapter` in `adapters/in-memory/`.

### 3. HTTP Transport Authorization (`FastifyAuthorizationAdapter`)
In `apps/api/src/plugins/authorization.ts`:
- Fastify request decoration:
  - `request.ability`: Lazily memoized `AppAbility` on first access.
  - `request.can(action, subject)`: Delegates directly to `request.ability.can(...)` or permission helpers.
  - `request.assertCan(action, subject, message)`: Throws RFC 9457 `401 UNAUTHORIZED` if anonymous or `403 FORBIDDEN` if unauthorized.
  - `fastify.authorize(actionOrHelper, resolver)`: Declarative route preHandler.

### 4. Frontend Reactive State (`ReactPermissionsAdapter`) & Headless UI
In `apps/web`:
- `PermissionsProvider` (`apps/web/src/modules/shared/providers/permissions-provider.tsx`): Computes and memoizes `getUserPermissions(userContext)`.
- `usePermissions()`: Context hook exposing `{ ability, can, cannot, assertCan }`.
- `useCan(action, subject)`: O(1) declarative permission hook with zero rule re-evaluations.
- `<Can do={action} on={subject} fallback={<Fallback />}>{children}</Can>`: Headless UI slot component adhering to Rule 14.
