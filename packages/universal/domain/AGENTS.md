# AGENTS.md — @vp/domain (Entities, Value Objects & Policy)

Instructions for any coding agent working on `@vp/domain`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/domain` is the portable half of the old `core/`: entities, value objects, and the ranking and
eligibility policy that decides what the product does, expressed as pure functions over structural
types. `apps/api` and `apps/worker` import it directly; `apps/web` reaches it through
`@vp/api-contracts`.

It was split out of `@vp/core` because one file - `packages/server/core/ports/storage-client.ts`, whose
`StorageBody` includes `Buffer` and `NodeJS.ReadableStream` - pinned the whole package to the server tier. The
driver ports and repository contracts stayed behind as `@vp/core`; everything portable is here.

---

## 2. Invariants

1. **Zero dependencies, zero I/O.** No `@vp/*` runtime dependency, no SDK, no `node:*`. This is T1
   foundation vocabulary: the words every other package speaks.
2. **Entities are declared here and aliased elsewhere.** `Video` and `Upload` live in `video.ts` and
   `upload.ts`; `@vp/core`'s `VideoRecord` and `UploadRecord` (`packages/server/core/repositories/`)
   are `export type X = Y` aliases, not a second copy of the fields. A rule in `@vp/domain-rules` and a repository in `@vp/core` must be talking about one
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
6. **Time units live in `time.ts`** (`MS_PER_DAY`, `SECONDS_PER_HOUR`, ...), exported as the
   `@vp/domain/time` subpath (not from the root barrel), and `public-feed.ts` imports them by that name.
   `no-tuning-literals.test.ts` fails on a minute, hour or day written as literal arithmetic in
   `apps/api/src/services`, `apps/worker/src`, `packages/server/adapters` or `packages/server/ffmpeg/src`.
7. **Input rules are not here.** The handle format helpers live in `@vp/validation`
   (`channels/handle-format.ts`), because a format check needs no entity and
   `validation-is-input-only.test.ts` forbids `@vp/validation` importing this package. This is entity and policy vocabulary; a
   predicate over submitted input belongs one package over.

---

## 3. Local Commands

```bash
pnpm --filter @vp/domain typecheck
pnpm --filter @vp/domain test
```
