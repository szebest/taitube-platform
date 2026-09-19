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

Instead, all authorization decisions must be evaluated declaratively through `@vp/core/permissions`:

```typescript
// ✅ CORRECT: Declarative evaluation via pure ability engine
const allowed = can(user, 'update', { type: 'video', resource: video });
if (!allowed) {
  throw new ForbiddenError();
}
```

---

## 2. Permission Engine Architecture (`@vp/core/permissions`)

The permission engine is a pure domain module with zero runtime dependencies on database drivers or web frameworks.

### Role Hierarchy
- **`GUEST`**: Unauthenticated caller. Can read public resources (`video:read` for public/unlisted, `category:read`, `comment:read`).
- **`USER`**: Authenticated consumer. Can react to videos, post comments, subscribe to channels.
- **`CREATOR`**: Content creator. Can initiate uploads, manage owned videos, moderate comments on owned videos.
- **`MODERATOR`**: Platform moderator. Can flag, pin, or remove abusive comments, inspect reports.
- **`ADMIN`**: Superuser. Full bypass across all actions and resources (`manage:all`).

### Declarative Policy Modules
Policies are grouped into cohesive pure functional rule builders:
- `video-policy.ts`: Video creation, updates, visibility changes, deletions.
- `comment-policy.ts`: Comment posting, editing, pinning, deletion (author + video creator moderation).
- `channel-policy.ts`: Channel branding, profile updates, handle ownership.
- `admin-policy.ts`: Category management, queue operations, DLQ replay.

---

## 3. Integration Across Layers

### Fastify API Transport Layer (`apps/api`)
Routes use the declarative `server.authorize(action, resourceResolver)` route decorator:

```typescript
server.patch('/v1/videos/:id', {
  preHandler: [
    server.requireAuth,
    server.authorize('update', async (req) => {
      return { type: 'video', resource: await videoService.getById(req.params.id) };
    }),
  ],
}, handler);
```

If authorization fails, the decorator automatically responds with an RFC 9457 Problem Details `FORBIDDEN` error.

### Repository Query Scoping (`core/repositories` & `adapters/postgres`)
Database queries must use declarative Drizzle query scoping helpers (`drizzleWhere` / row-level scopes) rather than assembling raw ad-hoc condition arrays:

```typescript
// Declarative scoping for caller-visible records
const whereClause = buildVisibilityScope(user);
const videos = await db.select().from(videosTable).where(whereClause);
```

### Frontend UI Layer (`apps/web`)
Components never perform inline permission calculations or inspect `user.role` directly. Instead, they use headless hooks and components:

```tsx
// Using headless authorization hook
const { canEdit, canDelete } = useVideoPermissions(video);

// Or declarative wrapper
<Can I="update" this={{ type: 'video', resource: video }}>
  <EditVideoModalButton videoId={video.id} />
</Can>
```
