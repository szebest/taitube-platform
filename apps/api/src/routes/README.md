# Routes Layer (HTTP Transport Adapters)

## Architectural Principle: Thin Transport Adapters

Every route module inside `apps/api/src/routes/` is strictly a **transport adapter** in our Ports & Adapters / Hexagonal Architecture. Route handlers MUST NEVER contain business logic, invoke repositories directly, perform database transactions, or coordinate entity lifecycles.

Instead, route handlers forward incoming HTTP requests directly to dedicated **Domain Services** located in `apps/api/src/services/`.

---

## Allowed Responsibilities in Routes
1. **Routing & Mounting**: Register paths and aliases (e.g. `/v1/categories`, `/categories`, `/v1/me/account`, `/v1/channels/:idOrHandle`).
2. **Input Validation**: Fastify Type Provider with Zod schemas for `params`, `querystring`, `headers`, and `body`.
3. **Authentication & Authorization Extraction**: Use `requireAuth(request)` or `requireAdmin(request)` to extract identity claims.
4. **Service Delegation**: Pass typed arguments to the domain service (`videoService.get(...)`, `channelService.getAccount(...)`, `categoryService.listActive(...)`, `dlqService.replay(...)`).
5. **Transport Response Formatting**: Set HTTP status codes (200, 201, 204, 304) and transport headers (`Cache-Control`, `ETag`).

---

## Strictly Forbidden in Routes
- ❌ **Direct Repository Invocations**: Never call `repositories.<entity>.<method>()` inside route handlers.
- ❌ **Domain Business Logic**: Never implement business invariants, authorization ownership checks, validation algorithms, or state machines inside route handlers.
- ❌ **Transaction / CAS Management**: Never execute database transactions or compare-and-set updates in route handlers.
- ❌ **Cache Orchestration**: Cache storage, invalidation, and coalescing belongs in services or adapters.

---

## Pattern Example

```typescript
// Good: Thin controller delegating to ChannelService
export function registerChannelsRoutes(app: FastifyInstance, options: ChannelsRoutesOptions): void {
  const channelService = options.channelService ?? new ChannelService({ ... });
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get('/v1/channels/:idOrHandle', { schema: { ... } }, async (request, reply) => {
    const channel = await channelService.getPublicChannel(request.params.idOrHandle);
    return reply.status(200).send(channel);
  });
}
```
