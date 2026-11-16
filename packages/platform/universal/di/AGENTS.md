# AGENTS.md - @kit/di (tokens and registry)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · composition on top of it:
> [@vp/composition](../../server/composition/AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): reusable outside this product, so it holds no app vocabulary and
depends only on platform packages (`pnpm boundaries`). It is the typed `Token<T>` (`src/token.ts`) and an
immutable `Registry` (`src/registry.ts`): `createRegistry().provide(provide(Token, value), ...)` returns a new
registry, and `registry.get(Token)` returns `Result<T, MissingProvider>`. It is universal, so a browser package can
declare a token; `@vp/composition` builds its lifecycle `Container` on the same `Token`.

## 2. Invariants

1. **Resolution is by identity.** A token's `name` is for messages; two tokens with one name never collide.
2. **Immutable.** `provide` returns a new frozen registry; the later provider of a token wins. Nothing is
   registered at import time and nothing reads a global.
3. **`get` never throws.** A missing provider is `MissingProvider` (`code: 'MISSING_PROVIDER'`, the token's name);
   the app's composition root turns it into a startup failure. No token has a silent default.
4. **No type assertion.** A lookup narrows with a type predicate on token identity, which is what binds `T`.
5. **Universal, T2.** Its one dependency is `@vp/result` (moving to `@kit/result`); it runs under `vitest` and
   `bun test`.

## 3. Local Commands

```bash
pnpm --filter @kit/di typecheck
pnpm --filter @kit/di test
bun test packages/platform/universal/di
```
