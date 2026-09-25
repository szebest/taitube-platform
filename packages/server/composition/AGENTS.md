# AGENTS.md — @vp/composition (The Container)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

The mechanism both deployables build their object graph with, and nothing else: a typed `Token<T>`, a
`Container` that resolves tokens to values, and the `start()` / `dispose()` lifecycle that runs over what was
resolved. Registrations live with their owners: `registerAdapters` in `@vp/adapters`,
`apps/api/src/composition/services.module.ts`, `apps/worker/src/composition/stages.module.ts`.

Decision record: [SDD ADR-25](../../../docs/SDD.md#adr-25--composition-one-container-configuration-is-a-value).

---

## 2. Invariants

1. **No reflection, no decorators, no dependency beyond `@vp/result`.** The token carries the type, so
   `get(VideoService)` types as `VideoService` without a cast and a missing edge is a compile error.
2. **A factory is synchronous.** I/O a value needs before it is usable goes in its `start` hook, which
   `start()` runs in construction order. `buildApp()` in a test therefore opens nothing.
3. **Resolution is by identity.** A token's `name` is for messages only.
4. **The container disposes what its factories built, never an override.** An override belongs to the
   caller that handed it in. Disposal runs in reverse construction order and is idempotent.
5. **Server, T2.** Nothing client-side imports it, and `start()` / `dispose()` speak `Result` from
   `@vp/result` (T1).

---

## 3. Local Commands

```bash
pnpm --filter @vp/composition typecheck
pnpm --filter @vp/composition test
```
