# AGENTS.md — @vp/concurrency (In-process Coalescing & Circuit Breaking)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`Singleflight`: concurrent calls with one key share one in-flight promise. It is a `Map<string, Promise>`
and nothing more, which is why it is not in `@vp/adapters`: no driver sits behind it, so it is not an
adapter, and a service importing it from there crossed the service-to-adapter edge for a data structure.

Consumers: `FeedService` (`apps/api/src/services/feed-service.ts`, handed one by
`apps/api/src/composition/services.module.ts`) and `RedisReactionCacheAdapter` (`@vp/adapters`).

`CircuitBreaker`: stops calling a dependency after a run of failures and lets one trial call through
after a cooldown, on a clock it is handed (`now`). Consumer: `FallbackViewBuffer` (`@vp/adapters`),
built by the external adapter family.

---

## 2. Invariants

1. **Layer 1, no `@vp/*` dependency, no runtime API.** It runs unchanged under Node and Bun.
2. **One implementation, so no port.** A second implementation is the moment to add one, not before.

---

## 3. Local Commands

```bash
pnpm --filter @vp/concurrency typecheck
pnpm --filter @vp/concurrency test
```
