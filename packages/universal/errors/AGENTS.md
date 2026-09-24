# AGENTS.md - @vp/errors (error taxonomy, failure variants & retry class)

Instructions for any coding agent working on `@vp/errors`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/errors` is the single-sourced error vocabulary. It owns:

- **`ErrorCodes`** - the machine-readable codes, which must match `docs/SDD.md` §6.2.
- **`Failure<C, D>`** - how domain code *returns* a failure (SDD ADR-24). The discriminant is `code`,
  whose type is a literal member of `ErrorCode`, so there is no second taxonomy. `InputFailure<C, D>`
  is the wire-safe kind: it names the field it rejected and repeats only what the caller sent.
- **`RETRY_CLASS`** - ADR-18's `'permanent' | 'transient'`, declared once per code, and
  `classifyError` / `toPipelineError` (`classify.ts`), which read it.
- **The shared failure factories** - `databaseUnavailable`, `cacheUnavailable`, `queueUnavailable`,
  `storageUnavailable` (`infra-failures.ts`, each with `.during(operation)` as a `fromPromise` mapper),
  the conflicts in `conflict-failures.ts` and `mediaFailure` in `pipeline-failures.ts`.

`PermanentError` / `TransientError` (`pipeline-error.ts`) are the BullMQ queue-boundary representation.
`instrument` in `apps/worker/src/composition/stages.module.ts` calls `toPipelineError`, which picks the
class from `RETRY_CLASS`, at the moment a stage's `Result` has to become a throw, because BullMQ's retry
contract is the exception. They are still thrown directly by `@vp/ffmpeg` (probe and run),
`assertCan` in `@vp/permissions`, `apps/api/src/plugins/auth.ts` and the in-memory channel repository;
the roots `no-domain-throw.test.ts` sweeps never throw them.

---

## 2. Invariants

- **T1 universal, zero dependencies.** No `@vp/*` dependency, no runtime dependency, no `node:*`.
- **`Failure` is how a rule, a service and a stage report a failure.** Not a class, not a bare
  `Error`, not a `string`. `tests/architecture/no-domain-throw.test.ts` enforces it over
  `@vp/validation`, `@vp/domain-rules`, `@vp/core`, `apps/api/src/services` and `apps/worker/src/stages`.
- **A new code lands in four places or not at all:** `ApiErrorCodes` (or `PipelineErrorCodes`),
  `PROBLEM_STATUS` in `@vp/api-contracts` `problem.ts`, `RETRY_CLASS` here, and SDD §6.2. The two maps
  are `Readonly<Record<ErrorCode, ...>>`, so omitting a code from either is a compile error;
  `tests/architecture/error-code-drift.test.ts` catches the SDD.
- **An infra failure's payload never reaches a client.** `operation` and `cause` are for the server
  log. Keep them out of `message` too - `message` is what `problemFor` puts in `detail`.
- **`classifyError` is the only answer to "is this permanent".** Not a class name, not a message,
  not an `isRetryable` field read off a shape. It returns `'permanent' | 'transient' | 'unknown'`,
  and `unknown` stays distinct because ADR-18 gives an unrecognised error a lower attempt cap.
  `tests/architecture/class-name-inference.test.ts` enforces it; `packages/server/adapters/s3/` is
  the one allowlisted exception, and the comment on the test's `OWNERS` says why.
- **Wire safety is a type, not a list.** Only `InputFailure` names a `field`, and only a failure that
  names a field is projected into `Problem.errors`. If you find yourself adding a per-field allowlist,
  the failure is in the wrong package.

---

## 3. Local Commands

```bash
pnpm --filter @vp/errors typecheck
pnpm --filter @vp/errors test
```
