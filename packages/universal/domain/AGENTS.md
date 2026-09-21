# AGENTS.md — @vp/domain (Entities, Value Objects & Policy)

Instructions for any coding agent working on `@vp/domain`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/domain` is the portable half of the old `core/`: entities, value objects, and the ranking and
eligibility policy that decides what the product does, expressed as pure functions over structural
types. It runs unchanged in `apps/web`, `apps/api` and `apps/worker`.

It was split out of `@vp/core` because one file — `core/ports/storage-client.ts`, which types
`StorageBody` as `Buffer | NodeJS.ReadableStream` — pinned the whole package to the server tier. The
driver ports and repository contracts stayed behind as `@vp/core`; everything portable is here.

---

## 2. Invariants

1. **Zero dependencies, zero I/O.** No `@vp/*` runtime dependency, no SDK, no `node:*`. This is T1
   foundation vocabulary: the words every other package speaks.
2. **Declare the narrow structural type you read.** A policy module that needs a video declares the
   handful of fields it actually reads (`PublicFeedCandidate`), rather than importing a record shape
   from `@vp/core/repositories`. That is what keeps the dependency pointing this way and not back.
3. **The status vocabulary is declared here and nowhere else.** `VIDEO_STATUSES`, `STEP_STATUSES`,
   `UPLOAD_STATUSES`, `RENDITION_STATUSES`, `VIDEO_VISIBILITIES` and `USER_ROLES` are the labels the
   database enums are built from, the unions `@vp/core/repositories` types its records with, and the
   values `@vp/api-contracts` builds its Zod enums from. Never retype one of these lists: import it.
4. **Policy constants carry domain-loaded names** — `TRENDING_GRAVITY`, `PUBLIC_FEED_VISIBILITY` — so a
   call site reads as a rule rather than as a magic number.
5. **Relative imports carry `.js`** (`./channel.js`), because CRA's webpack refuses extensionless ESM.

---

## 3. Local Commands

```bash
pnpm --filter @vp/domain typecheck
pnpm --filter @vp/domain test
```
