# AGENTS.md - @vp/result (Result type & combinators)

Instructions for any coding agent working on `@vp/result`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/result` is the mechanism every layer below the edge uses to return a failure instead of
throwing it (SDD ADR-24). It is `Result<T, E>`, its constructors, its guards, its combinators and
`assertNever`.

It knows nothing about `ErrorCode`, HTTP, BullMQ or this domain. If a change here needs to name a
video, a status or a retry class, it belongs in `@vp/errors`, `@vp/validation`, `@vp/domain-rules`
or an edge, not here.

The authority on how the three layers use it is
[docs/standards/error-handling.md](../../../docs/standards/error-handling.md).

---

## 2. Invariants

- **Zero runtime dependencies, forever.** T1 universal. It must typecheck with `"types": []` and no
  `@types/node`, and run unchanged in a browser, under `vitest` and under `bun test`.
- **No `ResultAsync` class.** Async code returns `Promise<Result<T, E>>`, so a plain `await` is
  always legal. `mapAsync` / `andThenAsync` take and return promises; nothing here is chainable
  through a wrapper object.
- **`tryCatch` / `fromPromise` / `fromThrowable` are the only sanctioned `catch` outside an
  adapter.** `tests/architecture/catch-confinement.test.ts` enforces that.
- **`assertNever` is the only `throw` in this package**, and the only one the no-domain-throw sweep
  allows a caller to reach.
- Every source file has its own `__tests__/<name>.test.ts`, and every compile-time guarantee has a
  `@ts-expect-error` fixture in `src/__tests__/type-fixtures/`. A guarantee asserted only at runtime
  is not the guarantee this package promises, so `pnpm --filter @vp/result typecheck` is part of its
  test suite, not a separate step.

---

## 3. Local Commands

```bash
pnpm --filter @vp/result typecheck
pnpm --filter @vp/result test
bun test packages/universal/result
```
