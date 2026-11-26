# AGENTS.md - @kit/primitives (time units)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): no app vocabulary, no dependency (`pnpm boundaries`). It holds the
time-unit constants in `src/time.ts` and nothing product-specific; a new generic constant goes in a file of its
own and is exported from `src/index.ts`. `universal`, layer 0, so an app's lowest vocabulary package can import it.

`tests/architecture/no-tuning-literals.test.ts` fails on a minute, hour or day written as literal arithmetic in the
server apps and packages: import the unit from here.

## 2. Local Commands

```bash
pnpm --filter @kit/primitives typecheck
pnpm --filter @kit/primitives test
```
