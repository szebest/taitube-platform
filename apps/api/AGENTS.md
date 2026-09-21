# AGENTS.md — @vp/api (Fastify REST API)

Instructions for any coding agent working on the Taitube API server (`apps/api`).

---

## 1. Scope & Architecture

`apps/api` is the Fastify 5 REST API and real-time Server-Sent Events (SSE) server running on Node.js 24.
- **Composition Root:** `apps/api/src/app.ts` instantiates concrete adapters (`adapters/postgres`, `adapters/redis`, `adapters/s3`, `adapters/bullmq`) and injects them into domain services.
- **Zero Concrete Driver Imports:** Route handlers and domain services must NEVER import `@aws-sdk/client-s3`, `ioredis`, `bullmq`, or Postgres/Drizzle directly.

---

## 2. Invariants & Rules

### Rule 1: Thin Route Transport Adapters
- Route definitions in `apps/api/src/routes/` are strictly transport adapters:
  - Validate parameters, querystrings, and request bodies using Zod via Fastify Type Provider.
  - Extract authentication context using `requireAuth(request)`, or read `request.user` on endpoints that also serve anonymous callers.
  - Delegate immediately to dedicated domain services in `apps/api/src/services/`.
  - Format HTTP status codes (`200`, `201`, `204`, `304`) and transport headers (`Cache-Control`, `ETag`).
- **Strictly Forbidden:** Calling repositories directly, executing database transactions, or orchestrating domain state inside route handlers.

### Rule 2: Deep Domain Services (>1:1 Ratio)
- Every domain resource has a corresponding service in `apps/api/src/services/` (`VideoService`, `UploadService`, `ChannelService`, `CategoryService`, `DlqService`, `QueueService`).
- Extract smaller, reusable domain services (`HttpCacheService`, `Singleflight`, `SseHub`) that higher-level services compose.
- Services must remain completely decoupled from Fastify transport objects (`FastifyRequest`, `FastifyReply`).

### Rule 3: One Authorization Mechanism — `AuthorizationPort` Inside Services
- There is exactly one place an authorization decision is made: a domain service calling
  `AuthorizationPort.can(...)` / `.assertCan(...)` with a `@vp/permissions` rule helper. The concrete
  implementation (`CaslAuthorizationAdapter`) is injected from the composition root.
- Routes carry **authentication** only: `requireAuth(request)` for a caller that must be signed in, or
  `request.user` when the endpoint also serves anonymous callers. They never check a role, an ownership
  field or a permission themselves, and they never resolve a resource in order to authorize it.
- Admin endpoints pass `request.user` to their service, which calls `assertAdminAccess`
  (`services/admin-access.ts`) — the single admin gate. The `x-admin-token` credential is resolved into
  `request.user` by `plugins/auth.ts`, because it is an identity, not a permission.
- There are no Fastify authorization decorators. `server.authorize`, `verifyPermission`, `request.authorize`,
  `request.assertCan` and `request.can` existed as four overlapping entry points; the async `request.authorize`
  was called without `await` on the reactions route and silently let every unauthorized write through. Do not
  reintroduce them.

### Rule 4: Standardized Error Handling
- Throw `PermanentError` or `TransientError` from `@vp/errors` at the error origin.
- The Fastify error handler serializes all errors to RFC 9457 Problem Details format.

---

## 3. Dedicated Skills & References

- **`api-domain-services`**: Route-to-service mapping and service composition.
- **`api-casl-authorization`**: Fastify CASL route protection.
- **`vp-fastify-sse-problem-json`**: Fastify conventions, SSE streaming, RFC 9457 errors.
- **Standards:**
  - Route guidelines: `apps/api/src/routes/README.md`
  - Service guidelines: `apps/api/src/services/README.md`
  - Testing standards: `docs/standards/testing.md`
  - Declarative authorization: `docs/standards/authorization.md`

---

## 4. Local Commands

```bash
# Run API in development mode
pnpm --filter @vp/api dev

# Run API unit test suite (using in-memory doubles)
pnpm --filter @vp/api test

# Typecheck API package
pnpm --filter @vp/api typecheck
```
