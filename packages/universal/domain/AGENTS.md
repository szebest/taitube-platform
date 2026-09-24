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
2. **Entities are declared here and aliased elsewhere.** `Video` and `Upload` live in `video.ts` and
   `upload.ts`; `@vp/core`'s `VideoRecord` and `UploadRecord` are `export type X = Y` aliases, not a second
   copy of 38 fields. A rule in `@vp/domain-rules` and a repository in `@vp/core` must be talking about one
   shape. A *policy* module that reads a handful of fields still declares the narrow structural type it needs
   (`PublicFeedCandidate`) rather than importing a record shape from `@vp/core/repositories` - that is what
   keeps the dependency pointing this way and not back.
3. **The status vocabulary is declared here and nowhere else.** `VIDEO_STATUSES`, `STEP_STATUSES`,
   `UPLOAD_STATUSES`, `RENDITION_STATUSES`, `VIDEO_VISIBILITIES` and `USER_ROLES` are the labels the
   database enums are built from, the unions `@vp/core/repositories` types its records with, and the
   values `@vp/api-contracts` builds its Zod enums from. Never retype one of these lists: import it.
4. **Policy constants carry domain-loaded names** — `TRENDING_GRAVITY`, `PUBLIC_FEED_VISIBILITY` — so a
   call site reads as a rule rather than as a magic number.
5. **Relative imports are extensionless** (`./channel`), as in every tier (`esm-specifiers.test.ts`).
6. **Time units live in `time.ts`** (`MS_PER_DAY`, `SECONDS_PER_HOUR`, ...), exported as `@vp/domain/time`, and
   every package above T1 spells a duration with them. `public-feed.ts` imports them by that name as well,
   so the module needs no relative specifier. `no-tuning-literals.test.ts` fails on a minute, hour or day
   written as literal arithmetic in a service, stage, adapter or `@vp/ffmpeg`.
7. **Input rules are not here.** The handle format helpers moved to `@vp/validation`, because a format check
   needs no entity and `@vp/validation` may not import this package. This is entity and policy vocabulary; a
   predicate over submitted input belongs one package over.

---

## 3. Local Commands

```bash
pnpm --filter @vp/domain typecheck
pnpm --filter @vp/domain test
```
