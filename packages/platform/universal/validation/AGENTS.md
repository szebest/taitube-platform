# AGENTS.md - @kit/validation (field failures and plain text)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · the failure types it builds:
> [@kit/errors](../errors/AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): reusable outside this product, so it holds no app vocabulary and
depends only on platform packages (`pnpm boundaries`). It is the plumbing every input rule shares, not the rules:

- **`defineFieldFailures(code)`** (`src/failures.ts`): `invalidField` and `invalidLength` bound to the one code
  the app gives a field rule without a code of its own. Each builds an `InputFailure` (`FieldFailure`), so it
  names the `field` it rejected and repeats only what the caller sent. `LengthBounds` is the `minLength` and
  `maxLength` pair a length rule takes.
- **`normalizePlainText`, `withinLength`** (`src/plain-text.ts`): user text kept as typed, control characters
  dropped, the ends trimmed, and its length counted in code points.

The rules themselves, and the code they are bound to, are the app's.

## 2. Invariants

1. **Input only.** Nothing here takes an entity, a port or a clock; a rule built on it is a pure function of its
   input and the limits the caller passes.
2. **The code is a parameter.** `defineFieldFailures` takes it; nothing here names one.
3. **Plain text is not parsed.** Markup is kept as typed and escaped wherever it is rendered; stripping tags would
   be a hand-rolled HTML parser.
4. **Universal, T4.** Its one dependency is `@kit/errors`; every suite runs under node and jsdom
   (`vitest.config.ts`, then `vitest.jsdom.config.ts`) and under `bun test`.

## 3. Local Commands

```bash
pnpm --filter @kit/validation typecheck
pnpm --filter @kit/validation test
bun test packages/platform/universal/validation
```
