# AGENTS.md - @vp/domain-rules (policy, invariants, state transitions)

Instructions for any coding agent working on `@vp/domain-rules`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

**The one-sentence test: a domain rule needs an entity.** It takes the input *plus* a `Video`, an
`Upload`, a `Channel` or a `UserContext` and returns `Result<T, Failure>` (SDD ADR-24). A predicate
that compiles without an entity type is validation and belongs in `@vp/validation`.

It runs against a repository read on the server and against a cached entity in the browser just as
readily. `apps/api` is the only runtime consumer today; `apps/web` does not import it, and
`packages/client/api-client/src/__tests__/universal-rules.test.ts` is the fixture that proves the
client tier can call these rules.

**T3, not T2**, because it composes `@vp/validation` and `@vp/permissions`, which are both T2, and a
sibling edge is the violation `packages/AGENTS.md` §2 forbids. The layer is a design statement: rules
sit above the policy and the validation they compose.

---

## 2. Invariants

- **Pure.** No `await`, no port, no repository, no `Date.now()` that was not passed in, no logging,
  no `throw`. `decideUploadOpen` takes `now` as an argument for this reason.
- **A rule returns a verdict, never a presentation.** No message aimed at a user, no status code, no
  toast. Two consumers answer the same failure differently - that is the whole point, and it is why
  `decideVideoRead` keeps `VIDEO_NOT_FOUND`, `FORBIDDEN` and the anonymous `UNAUTHORIZED` distinct;
  `publicReadFailure` is the separate step that disguises a `FORBIDDEN` as `VIDEO_NOT_FOUND` for an
  unprivileged consumer.
- **Absence is a rule's decision, not a repository's.** A repository returns `ok(null)`; whether a
  missing row is a failure is decided here.
- **One decision per file**, named `<thing>.rule.ts` (a mirrored pair shares one:
  `decideSubscribe`/`decideUnsubscribe`, `decideVideoReprocess`/`decideVideoDelete`), in a folder
  per resource (`admin`, `categories`, `channels`, `comments`, `reactions`, `uploads`, `videos`) with its own
  `index.ts`. Each resource except `admin` has
  a `failures.ts` exporting its variants and unions; `dlq/` holds only failures, and `authorize.ts` is the
  shared `UNAUTHORIZED` / `FORBIDDEN` gate.
- **Failures are `Failure`, not `InputFailure`.** They may carry ids, counts and internal state, so
  they name no `field` and `problemFor` keeps their payload off the wire.
- **Compose, do not restate.** `decideReact` calls `decideVideoRead` rather than repeating its
  branches.
- **Every suite runs under node and jsdom:** `pnpm --filter @vp/domain-rules test` runs `vitest.config.ts`
  and then `vitest.jsdom.config.ts`.

---

## 3. Local Commands

```bash
pnpm --filter @vp/domain-rules typecheck
pnpm --filter @vp/domain-rules test
```
