# AGENTS.md - @vp/validation (input rules, wire-safe failures)

Instructions for any coding agent working on `@vp/validation`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

**The one-sentence test: validation needs only the input.** If a predicate compiles without an
entity type, it belongs here. If it needs a `Video`, an `Upload` or a `UserContext`, it is a domain
rule and belongs in `@vp/domain-rules`. There is no third answer, and
`tests/architecture/validation-is-input-only.test.ts` tells you when you got it wrong.

Every rule is a pure function returning `Result<T, InputFailure>` (SDD ADR-24). Rules are grouped by
resource (`uploads/`, `videos/`, `channels/`, `categories/`), each with a `failures.ts`; the shared
`invalidField` / `invalidLength` builders live in `src/failures.ts`. `ALLOWED_CONTENT_TYPES`
(`uploads/allowed-content-type.ts`) is a typed constant, not configuration.

The API is the authority and runs each rule itself (`apps/api/src/routes/uploads.ts` calls
`validateStartUpload`; `apps/worker` imports this package too). `apps/web` does not import it today;
`packages/client/api-client/src/__tests__/universal-rules.test.ts` is the fixture that proves a
`client`-tier package can import and call these rules, so a form can run the same check before an upload.

---

## 2. Invariants

- **No entity type, ever.** No `@vp/domain`, no `@vp/core`, no hand-copied record shape, in the
  source **or** the [manifest](package.json). That is the machine-checked form of "input only".
- **Limits are arguments, not lookups.** `validateStartUpload(input, limits)`. Nothing here reads
  `MAX_UPLOAD_BYTES`, an env var, a config module or a hardcoded ceiling; the caller passes
  `UploadLimits` (the API builds them from its `AppConfig`).
- **Pure.** No `await`, no port, no `Date.now()` that was not passed in, no logging, no `throw`.
- **Failures are `InputFailure`**, so they name a `field` and repeat only what the caller sent.
  `problemFor` projects that into `Problem.errors`; nothing here decides how a failure is shown.
- **`VALIDATION_FAILED` is one code on purpose.** Build a new field rule from `invalidField` /
  `invalidLength` rather than inventing a code. A union of two `VALIDATION_FAILED` variants still
  switches exhaustively, and the consumer reads `field`.
- **Every suite runs under node and jsdom** (`vitest.config.ts`, then `vitest.jsdom.config.ts`), so a
  browser-hostile API fails a test rather than a review.

---

## 3. Local Commands

```bash
pnpm --filter @vp/validation typecheck
pnpm --filter @vp/validation test
```
