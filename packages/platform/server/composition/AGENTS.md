# AGENTS.md — @kit/composition (The Container)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

The mechanism both deployables build their object graph with and shut down through: a typed `Token<T>`
(from `@kit/di`, re-exported here), a `Container` that resolves tokens to values with the `start()` / `dispose()`
lifecycle that runs over what was resolved (`src/container.ts`, plus `closeOnDispose`), and `shutdownOnce` / `exitOnSignals`
(`src/shutdown.ts`), the drained, grace-bounded shutdown `apps/server/api/src/serve.ts` and
`apps/server/worker/src/process.ts` install on `SIGTERM` / `SIGINT`. Registrations live with their owners in
the app: its adapter registry and each deployable's composition modules.

Decision record: [SDD ADR-25](../../../../docs/SDD.md#adr-25--composition-one-container-configuration-is-a-value).

---

## 2. Invariants

1. **No reflection, no decorators, no dependency beyond `@kit/di` and `@kit/result`.** The token carries the type, so
   `get(VideoService)` types as `VideoService` without a cast and a missing edge is a compile error.
2. **A factory is synchronous.** I/O a value needs before it is usable goes in its `start` hook, which
   `start()` runs in construction order. `composeApp()` in a test therefore opens nothing.
3. **Resolution is by identity.** A token's `name` is for messages only.
4. **The container disposes what its factories built, never an override.** An override belongs to the
   caller that handed it in. Disposal runs in reverse construction order and is idempotent.
5. **Server, layer 3.** Nothing client-side imports it; its `Token` comes from `@kit/di` (layer 2), and `start()` /
   `dispose()` speak `Result` from `@kit/result` (layer 1).
6. **No logger dependency.** `ShutdownPlan.log` is a structural `ShutdownLog` (`info` / `error`), so a
   `@kit/logger` logger fits without this package importing it.

---

## 3. Local Commands

```bash
pnpm --filter @kit/composition typecheck
pnpm --filter @kit/composition test
```
