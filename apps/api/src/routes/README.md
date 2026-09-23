# Routes Layer (HTTP Transport Adapters)

## Architectural Principle: Thin Transport Adapters

Every route module inside `apps/api/src/routes/` is strictly a **transport adapter** in our Ports & Adapters / Hexagonal Architecture. Route handlers MUST NEVER contain business logic, invoke repositories directly, perform database transactions, or coordinate entity lifecycles.

Instead, route handlers forward incoming HTTP requests directly to dedicated **Domain Services** located in `apps/api/src/services/`.

---

## Allowed Responsibilities in Routes
1. **Routing & Mounting**: Register paths and aliases (e.g. `/v1/categories`, `/categories`, `/v1/me/account`, `/v1/channels/:idOrHandle`).
2. **Input Validation**: Fastify Type Provider with Zod schemas for `params`, `querystring`, `headers`, and `body`.
3. **Authentication Extraction Only**: Use `requireAuth(request)` for endpoints that require a caller, or read `request.user` for endpoints that also serve anonymous callers. Authorization is decided by the domain service through `AuthorizationPort` — never in a route.
4. **Service Delegation**: Pass typed arguments to the domain service (`videoService.get(...)`, `channelService.getAccount(...)`, `categoryService.listActive(...)`, `dlqService.replay(...)`).
5. **Transport Response Formatting**: Set HTTP status codes (200, 201, 204, 304) and transport headers (`Cache-Control`, `ETag`).

---

## Strictly Forbidden in Routes
- ❌ **Direct Repository Invocations**: Never call `repositories.<entity>.<method>()` inside route handlers.
- ❌ **Domain Business Logic**: Never implement business invariants, authorization ownership checks, role checks, validation algorithms, or state machines inside route handlers.
- ❌ **Transaction / CAS Management**: Never execute database transactions or compare-and-set updates in route handlers.
- ❌ **Cache Orchestration**: Cache storage, invalidation, and coalescing belongs in services or adapters.

---

## Pattern Example

```typescript
// A route module is a plugin: its services come from app.services, never an options object.
export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  const { channelService } = app.services;
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(getChannel.path, { schema: contractSchema(getChannel) }, async (request, reply) =>
    sendResult(reply, request, await channelService.getPublicChannel(request.params.idOrHandle))
  );
}
```

Register it by adding it to the `ROUTES` table in `routes/index.ts`; `buildApp` registers every entry
`routesFor(config.auth)` returns
with one uniform `await app.register(plugin)`. `route-plugins.test.ts` fails on a route module that
exports anything else or is missing from the table.
