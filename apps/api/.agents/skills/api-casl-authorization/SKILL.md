---
name: api-casl-authorization
description: Fastify declarative route authorization with CASL ability engine from @vp/core/permissions.
---

# API: Declarative Route Authorization

Guide for protecting Fastify routes using `@vp/core/permissions`.

---

## 1. Zero Hand-Checked Permissions

Never check roles or ownership inside route handlers:

```typescript
// ❌ WRONG
if (user.role !== 'admin' && video.userId !== user.id) reply.status(403).send(...);
```

---

## 2. Fastify Route Decorator

Use `server.authorize(action, resourceResolver)`:

```typescript
server.patch('/v1/videos/:id', {
  preHandler: [
    server.requireAuth,
    server.authorize('update', async (request) => {
      const video = await videoService.getById(request.params.id);
      return { type: 'video', resource: video };
    }),
  ],
}, async (request, reply) => {
  const updated = await videoService.updateMetadata(request.params.id, request.body);
  return reply.status(200).send(updated);
});
```

The decorator evaluates pure rules via `can(user, action, resource)` and responds with RFC 9457 `FORBIDDEN` if disallowed.
