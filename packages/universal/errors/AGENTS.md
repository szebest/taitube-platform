# AGENTS.md - @vp/errors (the app's error vocabulary, retry classes & product failures)

Instructions for any coding agent working on `@vp/errors`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · the machinery it builds on: [@kit/errors](../../platform/universal/errors/AGENTS.md)

---

## 1. Scope & Purpose

`@vp/errors` is this product's error vocabulary, built on `@kit/errors`. It owns:

- **`ErrorCodes`** - the machine-readable codes, which must match `docs/SDD.md` §6.2. `ApiErrorCodes` spreads in
  the codes the platform packages emit (`CommonErrorCodes` from `@kit/errors`, `PaginationErrorCodes` from
  `@kit/pagination`, `FormatErrorCodes` from `@kit/intl`) and adds the product's own; `PipelineErrorCodes` are
  the worker's.
- **`RETRY_CLASS`** - ADR-18's `'permanent' | 'transient'`, declared once per code, and **`errorCodeRegistry`**,
  the `defineErrorCodes` set the composition roots provide as `ErrorCodeRegistry` and pass to `classifyError`,
  `toPipelineError` and `asThrowable`.
- **The product failures** - `databaseUnavailable`, `cacheUnavailable`, `queueUnavailable`,
  `storageUnavailable` (`infra-failures.ts`, built with `unavailable`), the conflicts in `conflict-failures.ts`,
  `mediaFailure` in `pipeline-failures.ts`, and the webhook, live and watch-party failures.

`Failure`, `InputFailure`, `PermanentError` / `TransientError` and the classifiers are `@kit/errors`. `instrument`
in `apps/server/worker/src/composition/stages.module.ts` calls `toPipelineError` with `errorCodeRegistry` at the
moment a stage's `Result` has to become a throw, because BullMQ's retry contract is the exception.

---

## 2. Invariants

- **Universal, no product dependency.** Platform packages only (`@kit/errors`, `@kit/intl`, `@kit/pagination`), no
  third-party runtime dependency of its own, no `node:*`.
- **`Failure` is how a rule, a service and a stage report a failure.** Not a class, not a bare
  `Error`, not a `string`. `tests/architecture/no-domain-throw.test.ts` enforces it over
  `@vp/validation`, `@vp/domain-rules`, `@vp/core`, `apps/server/api/src/services` and `apps/server/worker/src/stages`.
- **A code a platform package emits is spread in, never repeated.** `api-error-codes.test.ts` holds that every
  platform code is in `ApiErrorCodes`; writing one of them as a literal here is a second source.
- **A new product code lands in four places or not at all:** `ApiErrorCodes` (or `PipelineErrorCodes`),
  `PROBLEM_STATUS` in `@vp/api-contracts` `problem.ts`, `RETRY_CLASS` here, and SDD §6.2. The two maps
  are `Readonly<Record<ErrorCode, ...>>`, so omitting a code from either is a compile error;
  `tests/architecture/error-code-drift.test.ts` catches the SDD.
- **An infra failure's payload never reaches a client.** `operation` and `cause` are for the server
  log. Keep them out of `message` too - `message` is what `problemFor` puts in `detail`.
- **`classifyError` is the only answer to "is this permanent".** See `@kit/errors`;
  `tests/architecture/class-name-inference.test.ts` enforces it.

---

## 3. Local Commands

```bash
pnpm --filter @vp/errors typecheck
pnpm --filter @vp/errors test
```
