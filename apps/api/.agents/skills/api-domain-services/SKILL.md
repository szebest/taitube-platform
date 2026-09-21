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

## 2. Deep Domain Services (>1:1 Ratio)

Every domain resource has a service in `apps/api/src/services/`:
- `VideoService`, `UploadService`, `CategoryService`, `ChannelService`, `DlqService`, `QueueService`.
- Factored-out reusable utility services:
  - `HttpCacheService`: Computes deterministic ETags and evaluates conditional requests (`If-None-Match`).
  - `Singleflight`: Coalesces concurrent reads to prevent cache stampedes.
  - `SseHub`: Manages Server-Sent Events subscribers and Redis pub/sub fanout.

---

## 3. Error Classification

Services classify errors at the throw site:
- `PermanentError`: Non-retryable (validation, 404 not found, 409 conflict, 403 forbidden).
- `TransientError`: Retryable (rate limiting, temporary network/storage disconnect).
Fastify global error handler converts them to RFC 9457 Problem Details.
