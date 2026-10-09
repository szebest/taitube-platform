---
name: api-casl-authorization
description: Where an authorization decision is made in apps/api, and why routes never make one.
---

# API: Authorization Through the Port

Guide for authorizing work in `apps/api` using `@vp/permissions` behind `AuthorizationPort`.

---

## 1. Zero Hand-Checked Permissions

Never check roles or ownership inline:

```typescript
// ❌ WRONG
if (user.role !== 'admin' && video.ownerId !== user.id) reply.status(403).send(...);
```

---

## 2. The Decision Lives in the Service

The route resolves identity; the service decides. `AuthorizationPort.assertCan` raises a `PermanentError`
that the error handler renders as RFC 9457 `401` (anonymous) or `403` (refused).

```typescript
// routes/videos.ts — transport only
server.patch('/v1/videos/:id', { schema }, async (request, reply) => {
  const user = requireAuth(request);
  const updated = await videoService.updateMetadata(user, request.params.id, request.body);
  return reply.status(200).send(updated);
});

// services/video-service.ts — the decision
this.auth.assertCan(
  canUpdateVideo,
  { user: userContext, video: existing },
  { action: 'update', subject: 'Video', message: 'Only the video owner or an admin may edit video metadata' }
);
```

---

## 3. Admin Endpoints

Operator services call `assertAdminAccess(this.auth, caller)` from `services/admin-access.ts` — the single
admin gate. `plugins/auth.ts` resolves the `x-admin-token` credential into `request.user`, because it is an
identity rather than a permission.

---

## 4. There Are No Authorization Decorators

`server.authorize`, `verifyPermission`, `request.authorize`, `request.assertCan` and `request.can` were four
overlapping entry points. The async `request.authorize` was called without `await` on the reactions route, so
its throw became an unobserved rejection and every unauthorized reaction was written anyway. Do not
reintroduce them.
