# AGENTS.md — @kit/concurrency (In-process Coalescing & Circuit Breaking)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`Singleflight`: concurrent calls with one key share one in-flight promise. It is a `Map<string, Promise>`
and nothing more, which is why it is not in the app's adapters: no driver sits behind it, so it is not an
adapter, and a service importing it from there crossed the service-to-adapter edge for a data structure.
Consumers: the app's services and cache adapters, each handed one by its composition root.

`CircuitBreaker`: stops calling a dependency after a run of failures and lets one trial call through
after a cooldown, on a clock it is handed (`now`). Consumer: the app's adapter that falls back to a
second store while the first is down.

---

## 2. Invariants

1. **Layer 1, no workspace dependency, no runtime API.** It runs unchanged under Node and Bun.
2. **One implementation, so no port.** A second implementation is the moment to add one, not before.

---

## 3. Local Commands

```bash
pnpm --filter @kit/concurrency typecheck
pnpm --filter @kit/concurrency test
```
