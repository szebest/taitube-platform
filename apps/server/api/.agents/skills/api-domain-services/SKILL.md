---
name: api-domain-services
description: Fastify 5 route-to-service patterns, thin transport adapters, domain service composition, and HTTP caching.
---

# API: Domain Services & Thin Route Adapters

Guide for structuring HTTP routes and domain services in `apps/api`.

---

## 1. Architectural Principle: Thin Route Adapters

Routes in `apps/api/src/routes/` are strictly transport adapters:
- Validate params/query/body with Fastify Zod TypeProvider.
- Extract authentication context (`requireAuth`).
- Delegate to dedicated domain service in `apps/api/src/services/`.
- Format HTTP status codes (`200`, `201`, `204`, `304`) and headers (`Cache-Control`, `ETag`).
- NEVER call repositories directly or execute database transactions in routes.

---

## 2. Deep Domain Services

Every domain resource has a service in `apps/api/src/services/`:
- `VideoService`, `UploadService`, `CategoryService`, `ChannelService`, `DlqService`, `QueueService`.
- Collaborators are injected and required; `composition/services.module.ts` builds them. A service never
  constructs or defaults one.
- Shared helpers are imported: `http-cache.ts` (ETags, conditional requests, `Cache-Control`) and
  `Singleflight` from `@vp/concurrency`.
- Routes are plugins reading `app.services`, registered from `routes/index.ts`.

---

## 3. Error Classification

Services classify errors at the throw site:
- `PermanentError`: Non-retryable (validation, 404 not found, 409 conflict, 403 forbidden).
- `TransientError`: Retryable (rate limiting, temporary network/storage disconnect).
Fastify global error handler converts them to RFC 9457 Problem Details.
