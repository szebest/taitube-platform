# 39: Declarative RBAC & ABAC permission engine (can(user, action, resource))

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 38 — User & channel identity profile |
| Blocks | 40, 41, 42, 44, 45, 46, 61 |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

Currently, authorization in the pipeline is scattered with ad-hoc checks (such as checking ownership directly in route handlers). As the platform grows to support community comments, moderation, creator studio operations, and administrative oversight, we require a unified, declarative permission engine.

Inspired by clean ABAC (Attribute-Based Access Control) and WebDevSimplified permission models:
1. Expressive, typed can(user, action, resource) permission evaluator.
2. Roles: GUEST, USER, CREATOR, MODERATOR, ADMIN.
3. Actions:
   - Videos: video:read, video:create, video:update, video:delete, video:publish
   - Comments: comment:create, comment:delete, comment:pin
   - Channels: channel:update, channel:manage
   - Admin: category:manage, analytics:view_all
4. Resource-level rules:
   - Resource owners can edit/delete their own resources (video.ownerId === user.id, comment.authorId === user.id).
   - Video owners can moderate (delete, pin) comments under their videos even if authored by someone else.
   - Admins can manage any resource.
5. Fastify authorization helper / decorator verifyPermission(action, resourceResolver) for seamless route protection.

## Acceptance criteria

- [ ] Pure domain permission package/module in @vp/core/permissions:
  - Typed definitions for Role, Action, UserContext, and Resource.
  - Pure function can(user: UserContext | null, action: Action, resource?: Resource): boolean.
  - Declarative policy rules map defining capabilities per role and dynamic predicates for ownership.
- [ ] Roles field on User entity: 
ole enum (USER, CREATOR, MODERATOR, ADMIN) defaulting to USER.
- [ ] Fastify authorization helper server.authorize(action, resourceResolver):
  - Throws 403 FORBIDDEN (or 401 if anonymous) with problem+json standard error format if can(...) evaluates to false.
- [ ] Unit tests for all combinations:
  - Guest permissions (video:read public allowed, video:create forbidden).
  - User permissions (cannot delete other users' videos/comments).
  - Creator / Video Owner permissions (can pin comments under own video, cannot pin on foreign video).
  - Admin permissions (superuser bypass).
- [ ] Integrated route test showing Fastify route returning 403 when forbidden and 200 when authorized.

## Out of scope

- Dynamic policy definition stored in database (rules are compiled code for maximum speed and type-safety).
- Multi-tenant enterprise team roles.

## Notes for the implementer

- Pure domain rules without I/O:
  ```ts
  export function can(user: UserContext | null, action: Action, resource?: any): boolean {
    if (user?.role === 'ADMIN') return true;
    const rule = POLICIES[action];
    if (!rule) return false;
    return rule(user, resource);
  }
  ```
- File structure: Keep policy rules organized in @vp/core/permissions/policies/ with <= 250 lines per file.

## Testing plan

- Matrix unit tests checking all role x action x ownership permutations.
- Route decorator integration tests with mock Fastify handlers.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
