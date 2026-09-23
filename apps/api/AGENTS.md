# AGENTS.md — @vp/api (Fastify REST API)

Instructions for any coding agent working on the Taitube API server (`apps/api`).

---

## 1. Scope & Architecture

`apps/api` is the Fastify 5 REST API and real-time Server-Sent Events (SSE) server running on Node.js 24.
- **Composition Root:** `apps/api/src/app.ts` composes one `Container`: `registerAdapters` from `@vp/adapters` picks the adapter family from `config.kind`, `composition/services.module.ts` registers every service, `composition/adapter-set.ts` is the `adapters` override seam tests use. `buildApp()` constructs and registers routes and starts nothing; `main.ts` calls `container.start()` and owns the drained shutdown. Nothing else constructs a concrete adapter or a domain service.
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
- **Validation belongs in `@vp/validation`, not in a route.** The size cap and `ALLOWED_CONTENT_TYPES` used to
  sit inline in `routes/uploads.ts`, which is how the browser ended up enforcing a narrower list and no size
  check at all. A route calls the shared rule; it does not hold one.

### Rule 2: Deep Domain Services, Total Dependencies
- Every domain resource has a corresponding service in `apps/api/src/services/` (`VideoService`, `UploadService`, `FeedService`, `ChannelService`, `CategoryService`, `ReactionService`, `SubscriptionService`, `SseService`, `DlqService`, `QueueService`).
- A service's dependencies are required. It never constructs, defaults or reads from `process.env` a collaborator or a setting it was not handed, and it imports nothing from `@vp/adapters` (`total-dependencies`, `adapter-instantiation` and `sdk-confinement` assert it). HTTP cache helpers are three functions in `http-cache.ts`; `Singleflight` comes from `@vp/concurrency`.
- Services must remain completely decoupled from Fastify transport objects (`FastifyRequest`, `FastifyReply`).
- Routes are plugins: `export async function xRoutes(app: FastifyInstance)`, reading `app.services` and `app.config`, registered from `routes/index.ts`.

### Rule 3: One Authorization Mechanism — `AuthorizationPort` Inside Services
- There is exactly one place an authorization decision is made: a domain service calling
  `AuthorizationPort.can(...)` with a `@vp/permissions` rule helper. The concrete implementation
  (`CaslAuthorizationAdapter`) is injected from the composition root.
- Routes carry **authentication** only: `requireAuth(request)` for a caller that must be signed in, or
  `request.user` when the endpoint also serves anonymous callers. They never check a role, an ownership
  field or a permission themselves, and they never resolve a resource in order to authorize it.
- Admin endpoints pass `request.user` to their service, which composes `decideAdminAccess` from
  `@vp/domain-rules` - the single admin gate, returning its verdict instead of throwing it. The
  `x-admin-token` credential is resolved into `request.user` by `plugins/auth.ts`, because it is an identity,
  not a permission. It exists in dev mode only: production refuses `ADMIN_TOKEN`, and an admin there is a
  token whose verified role claim says so.
- **Tokens are verified by the `TokenVerifier` port.** `plugins/auth.ts` never parses a JWT; the adapter
  `registerAdapters` picks from `config.auth.type` does, and the dev JWKS route is registered only in dev
  mode (`routesFor(config.auth)`).
- Authorization stays inside the domain; it just returns now. `authorize(actor, allowed, context)` in
  `@vp/domain-rules` is the one owner of the 401-vs-403 distinction: not signed in is `UNAUTHORIZED`, signed
  in without the permission is `FORBIDDEN`. `AuthorizationPort.assertCan` is gone; `can` stays.
- There are no Fastify authorization decorators. `server.authorize`, `verifyPermission`, `request.authorize`,
  `request.assertCan` and `request.can` existed as four overlapping entry points; the async `request.authorize`
  was called without `await` on the reactions route and silently let every unauthorized write through. Do not
  reintroduce them.

### Rule 4: Services Return Their Failures, Routes Render Them
- A service returns `Promise<Result<T, E>>` where `E` is **inferred** from what it composes - the union of the
  rule failures it evaluates and the infra failures of the ports it calls. Never widened to `Error`, `unknown`
  or a hand-written `DomainFailure`: a widened union is the same information loss as `throw`, one indirection
  later.
- A service contains no `throw`, no `try`, no `catch`, no logging of a failure and no HTTP vocabulary. It may
  **narrow** a union deliberately - `CategoryService.listActive` drops `CacheUnavailable` because the cache
  service falls through to the repository - and that narrowing is now visible in the signature.
- A route hands the `Result` to `sendResult`, the only unwrap point in `apps/api`. Default mapping, a
  per-code `options.on`, or a total `*.presenter.ts` module with `assertNever`; when to use which is in
  [docs/standards/error-handling.md](../../docs/standards/error-handling.md).
- `setErrorHandler` stays, narrowed to a backstop: transport validation, rate limiting, Fastify's own 4xx
  errors (answered with their own status) and genuine bugs. The auth hook answers its own 401 problem. Both paths call the same `problemFor`, so the body is identical either way.
- `PermanentError` / `TransientError` are the BullMQ queue-boundary representation only (ADR-18). Domain code
  in this app does not throw them.

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
