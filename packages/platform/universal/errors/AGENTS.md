# AGENTS.md - @kit/errors (failures, error code sets and retry classes)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · the token it declares:
> [@kit/di](../di/AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): reusable outside this product, so it holds no app vocabulary and
depends only on platform packages (`pnpm boundaries`). It is the machinery of an error vocabulary, not the
vocabulary itself:

- **`Failure<C, D>` / `InputFailure<C, D>`** (`src/failure.ts`): how domain code *returns* a failure. The
  discriminant is `code`; an input failure names the `field` it rejected and repeats only what the caller sent,
  so `failurePayload` takes nothing else.
- **`defineErrorCodes`** (`src/registry.ts`): an app's frozen `ErrorCodeSet`, every code mapped to its own name,
  one retry class per code and the code a boundary persists for an error that carries none. The
  `ErrorCodeRegistry` token has no default; the app provides its set at its composition root.
- **`classifyError`, `attemptsFor`, `errorCodeOf`, `toPipelineError`, `asThrowable`** (`src/classify.ts`): the
  one place a retry class is decided, always against the set the caller passes.
- **`PermanentError` / `TransientError`** (`src/pipeline-error.ts`): the queue-boundary throw, for a retry
  contract that is an exception.
- **`unavailable(code, message)`** (`src/unavailable.ts`): a factory for an infrastructure failure, with
  `.during(operation)` as a `fromPromise` mapper.
- **`CommonErrorCodes`** (`src/common-codes.ts`): the codes a platform package may emit without owning a
  domain, `VALIDATION_FAILED` and `INTERNAL`.
- **`InfraErrorCodes`, `InfraFailure`** (`src/infra-codes.ts`, `src/infra-failures.ts`): the four `*_UNAVAILABLE`
  codes, their `Unavailable` failure types and factories, which the ports of `@kit/ports` return.

## 2. Invariants

1. **A platform package owns the codes it emits.** It exports them as an `as const` object (`CommonErrorCodes`
   here, `PaginationErrorCodes`, `FormatErrorCodes`) and the app spreads them into its own set. No code is
   written twice, and no platform package imports the app's codes.
2. **No app code here.** A code that names a product resource belongs in the app's set.
3. **`retryClass` is total.** `ErrorCodeSet.retryClass` is a `Record` over the set's codes, so a code without a
   class fails to compile; a code outside the set is `transient` (ADR-18: retry a little, then park).
4. **`unknown` stays a third answer.** `classifyError` returns `'permanent' | 'transient' | 'unknown'`, and
   `attemptsFor` gives `unknown` a lower cap. Never collapse it into `transient`.
5. **An infra failure's payload never reaches a client.** `operation` and `cause` are for the server log and
   stay out of `message`.
6. **Universal, T3.** Its one dependency is `@kit/di`; it runs under `vitest` and `bun test`.

## 3. Local Commands

```bash
pnpm --filter @kit/errors typecheck
pnpm --filter @kit/errors test
bun test packages/platform/universal/errors
```
