# 82: Architecture remediation — package runtime tiers, contract seams & machine-enforced boundaries

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 81 — Declarative permissions refactor with @casl/ability |
| Blocks | 83, 84 |
| Spec | [SDD ADR-20 Monorepo topology](../SDD.md#adr-20-monorepo-topology-workspace-boundaries-and-contract-single-sourcing) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §6.4 Thin transport routes](../SDD.md#64-api-layer-architecture-thin-transport-routes-domain-services) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready-for-agent

> **Visual review report:** [`docs/reviews/82-architecture-remediation-review.html`](../reviews/82-architecture-remediation-review.html)
> — open it in a browser. Eight candidates with before/after seam diagrams, the documented-vs-actual table,
> and the reasoning behind the workstream ordering below. The workstreams in this ticket map to the report's
> candidates as: W1→1, W2→2+3, W3→4, W4→5, W5→6, W6→7, W8→(hygiene), W9→8. The report calls candidate 8
> *speculative* and says it is "worth doing only alongside candidate 3, which has to touch package configs
> anyway" — candidate 3 is W2, so that condition is now met and candidate 8 is **in scope as W9**.

---

## Why this ticket exists

An architecture review of the whole monorepo produced one finding that explains all the others:

> **Nearly every defect in this repo is something the repo already forbids in writing.**

The written rules are good. The enforcement is prose. `ARCHITECTURE.md` §6 is titled *"Verification &
Enforcement"* and then lists four `git grep` commands a human is expected to type by hand. Where a rule is
machine-checked it holds; where it is only written down it has drifted — and in three places it has drifted
far enough to become a live production defect.

The repo also grew backwards. It began as API + worker, so every shared package was implicitly server-side.
`apps/web` arrived later by `git subtree` and nothing in the workspace records which packages a browser may
import. That gap is the root cause of workstream **W2**.

### Evidence — documented vs. actual

| Documented | Actual | Enforced by |
|---|---|---|
| ADR-20: `packages/api-contracts` single-sources the HTTP contract | does not exist | nothing |
| ADR-20: `packages/api-client` generates typed hooks | does not exist | nothing |
| ADR-20: boundaries "enforced via ESLint/Biome import boundaries and CI build checks" | no such rule, no such job | nothing |
| SDD §15.1: `errors`/`config`/`job-contracts` have "zero runtime deps beyond zod" | `errors` declares `bullmq` | nothing |
| ADR-21 + `apps/web/AGENTS.md`: React 19 + TanStack Start + Vite 6 + Tailwind v4 | React 18.3.1 + CRA 5 + Redux + Bootstrap | nothing |
| Rule 1 local-first: "nothing phones home" | `apps/web` hardcodes `https://taitube-backend.onrender.com` | manual PR checklist |
| Rule 5 file discipline: 400-line hard ceiling | 4 production files over it (625 / 436 / 435 / 417) | nothing |
| Rule 12: 1:1 test file correspondence | 34% repo-wide; 83% of `apps/api` source files unmatched | nothing |
| `apps/api/AGENTS.md` Rule 3: use `server.authorize(...)` | **zero** production callers | nothing |
| Rule 4: concrete SDKs confined to `adapters/` | holds in source — the one rule that survived | nothing (luck) |

### The three live defects

1. **Public feed ignores `sort` and `categoryId` in production.**
   `core/repositories/video-repository.ts:105` declares both.
   `adapters/in-memory/repositories/feed-filter.ts:10` implements both (3 sort modes + category filter).
   `adapters/postgres/repositories/postgres-video-repository.ts:145` destructures `{ cursor, limit }` and
   drops them, then orders unconditionally by `createdAt DESC`.
   So `?sort=trending` returns recency order and `?categoryId=X` returns every category. Worse,
   `apps/api/src/routes/feed.ts:56` keys the Redis cache on `sort` + `categoryId`, so identical payloads are
   stored under N distinct keys. **Every test passes**, because tests run against the in-memory double —
   and `feed-filter.ts` has no test at all.

2. **Authorization bypass on reactions.**
   `request.authorize` is decorated as an `async function` (`apps/api/src/plugins/authorization.ts:203`).
   `apps/api/src/routes/reactions.ts:56` calls it **without `await`**, so the throw becomes an unobserved
   rejected promise and the handler proceeds regardless. The route's schema advertises a `403` that can never
   fire. It is the only route using `.authorize()`; the other three use the synchronous `.assertCan()`
   correctly. No reactions test asserts a 403.

3. **Local-first broken by the frontend.**
   `apps/web/src/config/index.ts:1` hardcodes an external host. The `vp-local-first-check` skill's own grep
   catches it on the first hit — it has simply never been run, because it lives in a manual checklist rather
   than CI. `make smoke-offline` never exercises `apps/web` because the app has no compose service.

---

## What to build

Nine workstreams. **Each lands as its own PR** on a shared `ticket/82-*` branch prefix; the ticket is done
when all nine are merged. W1 and W2 carry the defects and go first; the rest can run in parallel.

Ordering rationale: W1 fixes a user-visible bug, W2 fixes a Rule 1 violation, W3 makes the previous two
impossible to regress, W4–W8 are cleanups that ride on the structure W3 establishes, and **W9 goes last** —
it is the largest mechanical diff in the ticket and rebasing the other eight on top of it would cost more
than rebasing it on top of them.

---

### W1 — Contract conformance suite at the repository seam

The seam has two adapters and no shared test, which is exactly how a double ends up more capable than
production.

- Add `adapters/__tests__/contract/` — one parameterised suite per repository port, exported as a factory
  `describeVideoRepositoryContract(makeSubject)`.
- Run every suite twice: once against `InMemoryRepositories`, once against `PostgresRepositories` backed by
  PGLite (already a dev dependency path via `packages/db`; no Docker in unit tests).
- Fix `PostgresVideoRepository.listPublic` to honour `sort` (`recent` | `popular` | `trending`) and
  `categoryId`. The `trending` gravity score must match the in-memory formula
  `(views + 1) / (ageHours + 2) ** 1.5` — assert the ordering, not the float.
- Delete `adapters/in-memory/repositories/feed-filter.ts`'s divergent copy of the sort logic once both sides
  derive ordering from one shared, tested predicate builder.
- Extend the suite to the untested adapters: `adapters/s3`, `adapters/redis`, `adapters/bullmq` — **2,074
  lines with zero test files today**.

**Ownership note (senior practice — fix the class, not the instance):** do not patch `listPublic` alone. The
defect class is "a port declares a capability that only one adapter implements." The conformance suite is
what closes the class.

---

### W2 — Package runtime tiers + the client/server contract seam

This is the scoping problem stated directly. Today `apps/web → @vp/permissions → @vp/errors → bullmq → ioredis`.

Cause: `packages/errors/package.json:29` declares `"bullmq": "^6.3.4"` with **zero source imports**. Commit
`3bcf093` ("implement hexagonal ports-and-adapters architecture") correctly moved the `UnrecoverableError`
coupling into `adapters/bullmq` and removed the import — but left the dependency line behind. The CASL rule
engine, the one genuinely isomorphic module in the repo, therefore carries a Redis job queue in its declared
closure (5.4 MB + 1.1 MB `ioredis`).

**Declare a tier for every package.** Add `"vp": { "tier": "universal" | "server" | "client" }` to each
`package.json`:

| Tier | Packages | May import |
|---|---|---|
| `universal` | `errors`, `permissions`, `job-contracts`, `events`, `storage`, **`api-contracts` (new)** | `universal` only. No `node:*`, no server SDK. |
| `server` | `config`, `db`, `ffmpeg`, `observability`, `testing`, `core`, `adapters` | `universal` + `server` |
| `client` | **`api-client` (new)** | `universal` + `client` |

- Split `packages/tsconfig` into `base.json` (shared strictness), `server.json` (`@types/node`,
  `lib: ES2022`) and `universal.json` / `client.json` (`lib: ES2022, DOM`, **no** `@types/node`). Today there
  is one preset with `lib: ["ES2022"]` and no DOM, and `@types/node@^24` leaks in implicitly everywhere
  because no package sets `"types"`. A Node builtin in a `universal` package must become a compile error.
- Delete `packages/errors/package.json:29`. One line; converts `errors` **and** `permissions` to genuinely
  `universal`.
- Delete `core/permissions/` — it is `export * from '@vp/permissions';`, one line, **one importer, and that
  importer is a test** (`apps/api/src/__tests__/permissions.test.ts:2`), while 19 files import
  `@vp/permissions` directly, including `core/ports/authorization.port.ts` and
  `core/repositories/video-repository.ts` inside `core/` itself. Drop the `"./permissions"` subpath export and
  the `@vp/permissions` dependency from `core/package.json` — it is `@vp/core`'s only runtime dependency and
  exists solely to serve that re-export. *Deletion test: complexity concentrates nowhere; this is indirection,
  not a seam.*
- Move `packages/storage`'s one `@vp/adapters` test import (`storage.test.ts:1`, asserting presigned-PUT URL
  shape) into `adapters/s3`, which needs tests anyway (W1). A 61-line pure key-builder currently pulls
  `@aws-sdk`, `ioredis`, `bullmq`, `postgres` and `drizzle-orm` through the `adapters/index.ts` everything-barrel.

**Create `packages/api-contracts` (`universal`)** — the seam ADR-20 already mandates:

- One Zod schema per endpoint: request params, query, body, response, error codes.
- `apps/api` route schemas are **derived from** it, not parallel to it. Existing schemas in
  `apps/api/src/schemas/` move here.
- A drift test fails the build if a registered Fastify route has no matching contract entry.

**Create `packages/api-client` (`client`)** — typed fetchers generated from `@vp/api-contracts`, with the base
URL injected from config.

**Repoint `apps/web` at the real API:**

- Replace `apps/web/src/config/index.ts:1` with a config read (`REACT_APP_API_BASE_URL`), defaulting to the
  local API. Add the key to `.env.example`.
- Replace the 22 hand-written RTK Query endpoint definitions with `@vp/api-client` calls. **0 of 22 currently
  match `apps/api`** — none carry the `/v1` prefix every real route uses, and none of the comments,
  share or `/account/*` endpoints exist in this backend at all.
- Delete the 13 hand-duplicated model files under `apps/web/src/**/models/`. Sharpest example:
  `apps/web/src/modules/shared/helpers/category.helper.ts:3` is a hardcoded `Map<number,string>` of ids 0–6,
  while `apps/api/src/schemas/categories.ts:3` returns UUID + slug + `iconUrl` + `sortOrder`.
- Mount `PermissionsProvider` in `App.tsx`. It is exported and tested but **never mounted**, so `<Can>` and
  `useCan` are dead code — `usePermissions` throws outside the provider, so rendering `<Can>` anywhere in the
  real tree would crash. Replace the inline ownership check at
  `apps/web/src/modules/shared/components/video-card/video-card.tsx:68`
  (`video.userId === user.id`) with `<Can>`.

**Explicitly not in this ticket:** the React 19 / TanStack Start / Tailwind rewrite. See *Out of scope*.

---

### W3 — Machine-enforce every invariant

Add `tests/architecture/` — one suite, run in CI as a required check. Each invariant currently living in prose
becomes an assertion:

| Invariant | Assertion | Source of the rule |
|---|---|---|
| Package tiers | no `universal` package imports a `server` package or `node:*` | W2, ADR-20 |
| SDK confinement | `@aws-sdk/*`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm` appear only in `adapters/**` + the two composition roots + `packages/db` | Rule 4 |
| Local-first | no `https?://` literal outside localhost / compose service names / docs / cloud-gated env | Rule 1 |
| File ceiling | no production source file over 400 lines or 10 KB | Rule 5 |
| 1:1 tests | every source file has a name-matching test file | Rule 12 |
| Contract drift | every Fastify route has an `@vp/api-contracts` entry | W2 |

**Resolve the `packages/db` contradiction while here:** `AGENTS.md:25` forbids `drizzle-orm`/`postgres`
outside `adapters/`; `ARCHITECTURE.md:231` explicitly permits `packages/db`. Two documents, one invariant,
different rules. Pick the `ARCHITECTURE.md` version (it matches reality) and make `AGENTS.md` agree.

**Rule that any invariant which cannot be asserted gets deleted from the docs** rather than left as
decoration. Rewrite `ARCHITECTURE.md` §6 to point at the suite instead of listing greps.

**Bring `apps/web` into the toolchain:**

- Remove `"apps/web"` from `biome.json:56` `files.ignore` and fix the resulting findings. 208 files / 6,295
  lines are currently linted by nothing.
- Add a `typecheck` script. `apps/web` is the only workspace package without one, so `pnpm typecheck` silently
  skips the entire frontend.
- Align `typescript` (4.9.5 → 5.7.3) and `@types/node` (17 → 24). Move `typescript`, `@types/*` and the three
  `@testing-library/*` packages out of `dependencies` into `devDependencies`.
- Fix `turbo.json` `build.outputs`: it is `["dist/**"]` but CRA writes to `build/`, so `@vp/web` caches nothing
  and a cache hit restores nothing. Make outputs per-package or correct the path.

---

### W4 — Pull the escaped use cases back behind the service seam

Three route files hold complete use cases, so the logic is reachable only over HTTP and one copy has already
diverged.

- **`apps/api/src/routes/videos.ts:232-316`** — an 85-line reprocess handler doing a direct repository read,
  an inline state machine, job-ID construction, a full CAS transition with transactional outbox write, and a
  queue enqueue. The near-identical logic already exists at `apps/api/src/services/upload-service.ts:487-554`.
  Move it to `VideoService.reprocess()` and have both paths share it.
- **`apps/api/src/routes/events.ts`** — 293 lines, no service. Hand-rolled query-string token auth at `:19-36`
  (`?token=` → `verifyDevToken`, bypassing `plugins/auth.ts` entirely), 5 direct repository reads, progress
  arithmetic at `:164-174`, and a playback-URL projection at `:186` duplicating `services/types.ts:93`.
  Introduce `SseService` owning snapshot assembly and replay; `SseHub` keeps connection management.
- **`apps/api/src/routes/feed.ts:52-121`** — cache key invention, Redis read, conditional-request evaluation,
  `Singleflight` construction, TTL and ETag all in the route. It computes ETags with **sha1** while
  `HttpCacheService.generateEtag` uses **sha256** — two ETag algorithms in one API — and repeats the same
  `Cache-Control` literal **4 times** while `buildCacheHeaders()` exists with zero callers. Move to
  `FeedService` and adopt `HttpCacheService`.
- **Fix the authorization bypass** at `routes/reactions.ts:56` and **collapse the four competing mechanisms**
  (`request.assertCan`, `request.authorize`, raw `canX()` helper calls, imperative `requireAdmin`) to one.
  `server.authorize` — the seam `apps/api/AGENTS.md` Rule 3 mandates — has zero production callers and its
  alias `verifyPermission` has none at all. Either adopt it properly or delete it and amend the rule; four
  overlapping entry points is what produced the bug.
- **Split the two files over the ceiling:** `upload-service.ts` (625) into initiate / parts / complete / abort;
  `app.ts` (436). `app.ts` also carries a 33-field `BuildAppOptions` with two aliases for one thing
  (`reactionCache` / `reactionCacheAdapter`) and an `isInMemory` predicate that compares
  `constructor.name === 'InMemoryCacheClient'` — a string comparison that a minifier will break. Replace with
  an explicit adapter-set parameter.
- Move `plugins/jit-provisioner.ts` (domain logic: handle derivation with a `while (true)` collision loop,
  user+channel upsert) out of `plugins/` and unify its handle rules with `ChannelService:102-117`.
- Delete `apps/api/src/services/singleflight.ts` — a 1-line re-export alias whose only effect is to make the
  README's claim that Singleflight is an `apps/api` service read as true. `services/README.md:12` also claims
  `VideoService` uses it; `video-service.ts` never mentions it.

---

### W5 — Delete the second persistence layer

`packages/db/src/repository/{videos,steps,uploads}.ts` (371 lines) reimplements what
`adapters/postgres/repositories/` already does — `transitionVideo`/`transition`, `claimStep`/`claim`,
`completeStep`/`complete`, `failStep`/`fail`, `getVideoById`/`findById`.

The raw `claimStep` SQL is **byte-identical** across both. The return shapes have **already drifted**:
`packages/db` returns `{ lockToken: null, fenced: true }`, the adapter returns
`{ stepId, lockToken: '', fenced: true }`. Fencing is the one place in this system where a silent divergence
costs data.

Its only consumer is its own test. It is exported through `packages/db/src/index.ts`, so every
`import * as schema from '@vp/db'` pulls it into the module graph.

Delete the directory and its 257-line test. `packages/db` keeps schema, client, migrate, seed.

---

### W6 — Spend the pagination module that already exists

`core/pagination/` is the best-made small module in the repo: a 2-method `CursorCodec` with two real
implementations, `Base64UrlCursorCodec` deliberately using `btoa`/`atob` rather than `Buffer` so it runs
unchanged in Node, Bun and the browser, and a `Paginator` hiding the whole `limit + 1` sentinel protocol.

It is used by `apps/api` only. The adapters that actually produce paginated rows each reinvented it:

- `adapters/postgres/repositories/postgres-dlq-repository.ts:15-30` and
  `adapters/in-memory/repositories/in-memory-dlq-repository.ts:14-29` — **byte-identical** 16-line cursor
  codecs, both using `Buffer` (defeating the isomorphism), both hardcoding `20`/`100` in defiance of
  `PAGE_SIZE_DEFAULT`/`PAGE_SIZE_MAX` from `packages/config`.
- The descending-keyset comparison is written **four times**: `postgres-subscription-repository.ts:27-37`,
  `in-memory-subscription-repository.ts:21-33`, and twice inline in one file at
  `postgres-video-repository.ts:118-123` and `:159-164`.

Route every cursor through `core/pagination`. Lift `keysetBefore` into `adapters/postgres/scopes/` so the
other call sites can reach it.

---

### W7 — Narrow the interfaces that got wide

- **`VideoRepository` is 17 methods**, six of which are the same stale-row scanner shape
  `(thresholdMs, limit) => Promise<VideoRecord[]>`: `findStaleUploading`, `findStaleUploadedWithoutProbe`,
  `findStaleProcessing`, `findSoftDeleted`, `findExpiredRaw`, `findReadyWithOldGenerations`. Postgres already
  collapses all six onto two private helpers (`findLocked`, `findJoinedLocked`) — the tell that the port should
  express one scan concept with a predicate. Each extra method forces a matching method in **both** adapters.
- **`core/ports/index.ts:11`** is `export * from '../repositories/index'`, so `@vp/core/ports` also exports all
  12 repository interfaces. Imports: **108** via `@vp/core/ports`, **11** via `@vp/core/repositories`. "Ports"
  no longer means ports and the `./repositories` subpath is vestigial. Stop re-exporting.
- **Delete 4 dead re-export shims** in `core/repositories/` (`category-`, `channel-`, `subscription-`,
  `video-reaction-repository.ts`, 4 lines each, **zero importers including tests** — the barrel exports the
  `.port` files directly, so they are not even reachable).
- **BullMQ leaks through the `JobQueue` port.** `adapters/in-memory/in-memory-job-queue.ts:24-25` carries
  `metaValues = { version: 'bullmq' }` and `opts = { prefix: 'bull' }` — neither is on the port — purely
  because `apps/api/src/services/queue-service.ts:134` fabricates a BullMQ-shaped dummy for Bull Board and
  `:142` duck-types past the port via `getRawQueue()`. Introduce a `BullBoardAdapter` in `adapters/bullmq/`
  and take the BullMQ vocabulary out of `services/` and out of the double.

---

### W8 — Repo hygiene, docs and agent tooling

The project vendors **60 skill packages** under `.agents/skills/` with proper per-source attribution and
pinned commits — including `codebase-design`, `grilling`, `domain-modeling`, `to-tickets`,
`hexagonal-port-adapter`, `verification-before-completion` and 9 in-house `vp-*` skills — plus 7 more under
`apps/*/.agents/skills/`. **None is registered with Claude Code**, because there is no `.claude/` directory.
The library is invisible to the tool it was assembled for.

- Register skills: `.claude/skills` → `../.agents/skills`, and the per-app equivalents. Add the missing
  `improve-codebase-architecture` skill (MIT, same upstream) and update
  `.agents/skills/.licenses-video-pipeline-skills/ATTRIBUTION.md`.
- **Delete the three web skills that document a stack the app does not use** — `web-tanstack-query`,
  `web-headless-ui`, `web-player-hls` describe TanStack, Radix, Tailwind and hls.js, all of which have **0
  occurrences** in `apps/web/src`. **Done:** all three removed, which empties `apps/web/.agents/` entirely —
  so `apps/web` has no `.claude/skills` link either. They come back with the frontend rewrite (tickets
  49–75), rewritten against whatever that migration actually installs rather than against ADR-21's wishlist.
  `apps/web/AGENTS.md` §4 records this so the next reader does not assume the skills were lost.
- **Replace the three symlink scripts with one.** `mklinks.sh` (40), `mklinks.bat` (12) and
  `create-claude-symlinks.ps1` (60) maintain one folder list in three languages, and **all three are already
  stale** — none includes `packages/permissions`, whose `CLAUDE.md` was created by hand. Derive the list from
  `find . -name AGENTS.md` instead of hardcoding it.
- **Create `docs/adr/`.** `docs/agents/domain.md` instructs every engineering skill to read it; it does not
  exist. All ADRs live inline in SDD §4. Either extract them or amend `domain.md` to point at SDD §4 —
  currently the agent tooling is told to read a directory that isn't there.
  **Decision: amend `domain.md`, do not create `docs/adr/`.** Extracting 23 ADRs into files either duplicates
  SDD §4 or guts a document every ticket links into by anchor, and Rule 3 forbids a contract with two homes.
  `domain.md` now says plainly that there is no `docs/adr/`, that SDD §4 is where ADRs are read *and*
  written, and that the single-context scaffolding (`CONTEXT-MAP.md`, `src/<context>/docs/adr/`) does not
  apply here.
- **Fix `packages/tsconfig/AGENTS.md`:** claims NodeNext module resolution (actual: `bundler`) and lists
  `noImplicitAny` / `exactOptionalPropertyTypes` invariants that **do not exist** in `base.json`.
- **Rewrite `apps/web/AGENTS.md`** to describe the app as it is, with the target state marked as target.
  Every one of its four "Local Commands" is broken (`dev` and `typecheck` scripts don't exist; `vitest` isn't
  installed in the package).
- **Add `packages/permissions` to the root `AGENTS.md` shared-packages index** — it is the largest shared
  package by test count and the only one the frontend consumes, and it is the single omission from the list.
- **Delete `check_ci.py`** from the repo root — hardcoded to the merged branch
  `ticket/80-ci-test-pipeline-optimization-speed`. Delete `scripts/remove-js-extensions.py`, a completed
  one-shot codemod.
- **Collapse the 4-layer e2e wrapper chain** (`make e2e` → `scripts/e2e-suite.sh` → `scripts/run-e2e.ts` →
  `tests/e2e/e2e-runner.ts`); three of the four layers are argv pass-throughs.
- **CI speed** (Rule 11): four jobs each run a full `pnpm build` against four private `.turbo` caches keyed by
  `${{ github.sha }}`, so the exact key never hits and every commit writes four new entries. The `e2e` job has
  no turbo cache at all and still builds. Share one cache namespace, or enable remote caching. Also:
  `load-smoke.yml:9` triggers a full k6 load test on any `apps/**` change, including frontend-only edits, and
  `:24` installs without `--frozen-lockfile` or a pnpm cache.

#### Found while verifying W8 — `pnpm build` is red, and it is a tier-packaging decision (not W8)

`pnpm --filter @vp/web build`, and therefore the root `pnpm build` and the four CI jobs that run it, fail:

```
Module not found: Error: Can't resolve '../types' in 'packages/universal/permissions/dist/rules'
BREAKING CHANGE: The request '../types' failed to resolve only because it was resolved as fully specified
```

`@vp/permissions` declares `"type": "module"` and compiles with `moduleResolution: "bundler"`, so its `dist/`
keeps extensionless relative imports. Node resolves those only under a bundler; webpack 5 — which CRA gives
`apps/web` — applies strict ESM resolution to a `"type": "module"` dependency and refuses them. It bites
`@vp/permissions` first only because that is the first universal package with a browser consumer;
`@vp/api-contracts` and `@vp/api-client` have the same shape.

The universal tier now has a browser consumer, so **how it emits** is part of the tier decision, not an
`apps/web` bug, and the fix belongs with W2/W9 rather than hygiene. Three options, none free:

1. `moduleResolution: "nodenext"` for the universal + client packages and `.js` on every relative import —
   note `scripts/remove-js-extensions.py`, deleted in W8, was the codemod that took them *off*.
2. Bundle those packages on build (tsup/esbuild), which also fixes the `"types"`/`"exports"` story.
3. Have `apps/web` consume source rather than `dist` — impossible under CRA without ejecting.

Whichever is chosen belongs in ADR-23, which the Documentation DoD calls for and which SDD §4 still lacks
(ADR-23 records it).

---

---

### W9 — Flatten the workspace and make the tier a physical boundary

W2 made the tier a **declaration** (`vp.tier` in `package.json`). A declaration can be typo'd, copy-pasted or
simply forgotten on a new package. W9 makes it a **location**, so an untiered package cannot exist and a
browser bundle cannot reach a server package by accident rather than by decision.

**Why now.** The review report marked this *speculative* and said it is "worth doing only alongside
candidate 3, which has to touch package configs anyway". Candidate 3 is W2. That condition is met, so the
per-package config churn is already paid for and the remaining diff is import paths.

#### W9a — One layout, tier-scoped

`core/` and `adapters/` sit at the repository root for historical reasons only, and that inconsistency has
already propagated: `pnpm-workspace.yaml:5-6` carries two one-off literal entries, which forced two more in
`vitest.config.ts:8-9`. Root `observability/` is config-only and is read by `packages/observability`'s tests
through a repo-root path walk.

```
packages/
├── universal/   # runs in a browser AND on a server. No node:*, no server SDK.
├── server/      # Node/Bun only
└── client/      # browser only
apps/            # deployables, not shared libraries — stays flat
├── api/         # server
├── worker/      # server
└── web/         # client
tools/           # server-side dev CLIs
```

- `pnpm-workspace.yaml` becomes globs only: `apps/*`, `packages/*/*`, `tools/*`. No literal package entries.
  Delete the matching one-off entries in `vitest.config.ts`.
- Move root `observability/` (Grafana/Prometheus artifacts) next to the code that validates it.
- Package **names** stay flat (`@vp/core`, `@vp/errors`) — only directories move. Import specifiers in source
  do not change; `package.json` paths, tsconfig `extends`, turbo globs, Docker build contexts and CI paths do.
- `vp.tier` stays, and the architecture suite asserts **tier === parent directory**. Two sources that must
  agree is a drift bug waiting to happen, so the assertion is what makes keeping both safe.

**The win over metadata alone:** `apps/web`'s permitted import set becomes one glob
(`packages/universal/*` + `packages/client/*`), readable by tools that will never parse `vp.tier` — biome,
tsconfig project references, `turbo run --filter`, and a Dockerfile's `COPY` list.

#### W9b — Split the packages whose tier is decided by one file

The point of the tiers is **maximum reuse without leakage**. A package that is 95% portable but carries one
server-only module has to be declared `server` wholesale, which puts the portable 95% out of the frontend's
reach — and the frontend then re-declares what it cannot import. Every row below was produced by sweeping
each package for `node:*`, `process.*`, `Buffer`, `NodeJS.*` and `__dirname` outside tests, not assumed.

| Package | Tier today | Non-portable files | Verdict |
|---|---|---|---|
| `core` | server | **1 of 39** | **split** |
| `packages/ffmpeg` | server | 3 of 7 | **considered, deferred** — no consumer today |
| `packages/db` | server | 3 of 7 | **split the vocabulary only** |
| `packages/config` | server | 1 of 2 | **split** |
| `adapters` | server | 7 of 73 | keep whole — see below |
| `packages/observability` | server | 4 of 6 | keep whole — `prom-client`, `pino`, otel-sdk-node, `http` |
| `packages/testing` | server | 1 of 2 | keep whole — it is a vitest config factory |
| `permissions`, `errors`, `events`, `job-contracts`, `storage`, `api-contracts`, `api-client` | universal/client | 0 | already correct |

**`core` — one file pins thirty-eight.** With `@vp/core` at zero runtime dependencies after W2, the only
non-portable source in the package is `core/ports/storage-client.ts`, which types
`StorageBody = Buffer | Uint8Array | NodeJS.ReadableStream | string` and `getObject(): Promise<Buffer>`.
That single file pins `domain/` (pure policy), `pagination/` (deliberately isomorphic — `cursor-codec.ts`
uses `btoa`/`atob` specifically so it runs in a browser, and only *mentions* `Buffer` in a comment),
`repositories/` (types only) and the rest of `ports/` to the server tier.

| New package | Tier | Holds |
|---|---|---|
| `@vp/domain` | universal | `core/domain/` — entities, value objects, ranking and eligibility policy |
| `@vp/pagination` | universal | `core/pagination/` — `CursorCodec`, `Paginator`, the `limit + 1` protocol |
| `@vp/core` | server | `core/ports/` + `core/repositories/` — keeps its name, so 140 imports do not move |

**Three packages, not four.** An earlier draft also split `core/repositories/` into a universal
`@vp/contracts`. It has no client consumer and cannot acquire one: `apps/web` does not import `@vp/core` at
all, and all 16 importers of `@vp/core/repositories` are server-side — the frontend's response types come
from `@vp/api-contracts`. A universal package nothing universal consumes is an extension point without a
consumer, so repository interfaces stay with the ports they serve.

**`adapters` is the counter-example and stays whole.** Only 7 of 73 files name a Node builtin, but the tier
is not decided by builtins here: every subfolder wraps a concrete server SDK (`@aws-sdk`, `ioredis`,
`bullmq`, `postgres`, `drizzle-orm`), and even the in-memory doubles implement ports typed with `Buffer`.
Splitting it would produce fragments with one consumer each. **Do not split it.** The rule is "is there
portable logic trapped in here", not "count the imports".

**`packages/ffmpeg` — split considered and deferred.** `ladder.ts` (`CANONICAL_LADDER`, `selectLadder`) and
`master.ts` (HLS master-playlist text) import nothing but types from `@vp/job-contracts` and would be
portable; `probe.ts`, `transcode.ts` and `thumbnail.ts` spawn child processes. But nothing on the client
consumes a rendition ladder today — the player renders no quality selector — so the split would create a
universal package with no universal consumer and collapse no existing duplication. **Revisit when a client
first needs the ladder**; at that point it is a split, not a second hardcoded list. Every other split in this
table collapses a duplication that exists right now.

**`packages/db` — the status vocabulary is declared three times.** `videoStatusEnum` and its siblings are
drizzle `pgEnum` calls, but `VideoStatuses` / `StepStatuses` / `UploadStatuses` / `RenditionStatuses` are
plain string arrays. The same video status list exists at `packages/db/src/schema.ts:21`,
`core/repositories/video-repository.ts:11` and `packages/api-contracts/src/video-resource.ts:4` — three
copies held together only by W2's drift test, and they exist *because* a universal package cannot import a
server package. Move the vocabulary to a universal package and have the drizzle `pgEnum` and both other
consumers derive from it. Delete the drift test that was compensating for the missing seam. The rest of
`packages/db` (schema, client, migrate, seed) stays server.

**`packages/config` — a universal schema behind a server loader.** `src/index.ts:131` and `:147-148` guard
`process.env` and `process.exit` with `typeof process !== 'undefined'` — a runtime feature-detect standing in
for a boundary the type system should draw. Split the Zod schema and derived types (universal) from the
loader that reads `process.env`, applies dotenv and exits on failure (server). `apps/web` then consumes the
schema without a `typeof process` guard, and `REACT_APP_API_BASE_URL` stops being a server-schema key that a
browser happens to read.

**The rule, not just these cases:** a package is `server` only if code that *must* run on a server lives in
it. If the server-only part is separable, separate it. Apply the ticket's own deletion test first — if a
split produces a package with one consumer and no distinct reason to exist, do not split it.

#### W9c — Enforce it

Extend the W3 architecture suite (do not start a second one):

- `vp.tier` equals the package's parent directory under `packages/`.
- No `packages/universal/*` or `packages/client/*` package declares a `packages/server/*` package as a
  `dependency` or `peerDependency` — checked from the dependency graph, not only from import statements, so
  the `packages/errors` → `bullmq` class of defect is caught at the manifest.
- `apps/web`'s transitive runtime closure contains **no** `server`-tier package. Assert it from the resolved
  lockfile, so it holds for transitive edges no import scan would see.
- A deliberately-violating fixture proves each assertion fires, as with every other invariant in W3.

---

## Acceptance criteria

### W1 — Contract conformance
- [ ] `adapters/__tests__/contract/` exports a factory suite per repository port, executed against **both**
      `InMemoryRepositories` and `PostgresRepositories` (PGLite).
- [ ] `PostgresVideoRepository.listPublic` honours `sort` (`recent`/`popular`/`trending`) and `categoryId`;
      the conformance suite asserts identical ordering and filtering from both adapters.
- [ ] A test proves the pre-fix behaviour fails: `?sort=trending` and `?categoryId=` return adapter-dependent
      results before the fix, identical results after.
- [ ] Sort/filter predicate logic exists in exactly one module; `feed-filter.ts` no longer holds a private copy.
- [ ] `adapters/s3`, `adapters/redis`, `adapters/bullmq` have test files (currently 2,074 lines, 0 tests).

### W2 — Tiers & contract seam
- [ ] Every `package.json` declares `"vp": { "tier": ... }`; the tier table above is reflected in `ARCHITECTURE.md`.
- [ ] `packages/tsconfig` exposes `base` / `server` / `universal` / `client` presets; `universal` and `client`
      have `lib` including `DOM` and **no** `@types/node`.
- [ ] `packages/errors/package.json` no longer declares `bullmq`; `pnpm why bullmq` from `apps/web` returns nothing.
- [ ] `core/permissions/` deleted, the `"./permissions"` subpath export removed, and `@vp/core` has **zero**
      runtime dependencies.
- [ ] `packages/storage` has no `@vp/adapters` devDependency; the presigned-URL assertion lives in `adapters/s3`.
- [ ] `packages/api-contracts` exists (tier `universal`), holds every endpoint schema, and `apps/api` routes
      derive their schemas from it. A drift test fails when a route has no contract entry.
- [ ] `packages/api-client` exists (tier `client`) and is generated from `@vp/api-contracts`.
- [ ] `apps/web` reads its base URL from config, defaulting to the local API; `.env.example` carries the key;
      **no hardcoded external host remains anywhere in the repo**.
- [ ] `apps/web` calls `@vp/api-client`; the 22 hand-written endpoints and 13 duplicated model files are gone.
- [ ] `PermissionsProvider` is mounted in `App.tsx`; `video-card.tsx:68`'s inline ownership check is replaced
      by `<Can>`; a test renders `<Can>` inside the real provider tree.

### W3 — Enforcement
- [x] `tests/architecture/` asserts all six invariants in the table above and runs in CI as a named fail-fast
      step in `lint-typecheck` (`pnpm test:architecture`) and again inside `pnpm test`. Marking that check
      *required* is a GitHub branch-protection setting, not a repository file — `main` currently has no
      protection rule, so that half is outstanding.
- [x] Each assertion is proven by a deliberately-violating fixture that makes it fail.
- [x] `apps/web` removed from `biome.json` ignore list, lint clean.
- [x] `apps/web` has a `typecheck` script; `pnpm typecheck` covers every workspace package.
- [x] `apps/web` uses TypeScript 5.7.3 and `@types/node@24`; `typescript`, `@types/*` and `@testing-library/*`
      moved to `devDependencies`.
- [x] `turbo.json` outputs match each package's real build directory; `@vp/web` is cacheable.
- [x] `AGENTS.md` Rule 4 and `ARCHITECTURE.md` §6 agree on `packages/db`; §6 points at the suite, not at greps.

### W4 — Service seam
- [ ] `routes/reactions.ts:56` fixed; a test asserts a real `403` for an unauthorized reaction.
- [ ] One authorization mechanism across all routes; unused decorators deleted or adopted, and
      `apps/api/AGENTS.md` Rule 3 matches what the code does.
- [ ] Reprocess lives in `VideoService`; `routes/videos.ts` performs no repository, CAS, outbox or queue calls.
- [ ] `SseService` owns snapshot assembly and replay; `routes/events.ts` performs no repository reads and no
      progress arithmetic; the `?token=` query-string auth path is removed.
- [ ] `FeedService` owns feed caching; exactly **one** ETag implementation exists repo-wide;
      `HttpCacheService.buildCacheHeaders` is used or deleted.
- [ ] No production source file exceeds 400 lines / 10 KB — verified by the W3 assertion.
- [ ] `BuildAppOptions` takes an explicit adapter set; the `constructor.name` string comparison is gone.
- [ ] `services/singleflight.ts` deleted; `services/README.md` claims match the code.

### W5 — Dead persistence
- [ ] `packages/db/src/repository/` and its test deleted; `packages/db/src/index.ts` no longer exports them.
- [ ] `pnpm test`, `pnpm test:bun`, `pnpm typecheck` green with no replacement code added.

### W6 — Pagination
- [ ] All cursor encode/decode routes through `core/pagination`; no `Buffer`-based codec remains in `adapters/`.
- [ ] Page bounds derive from `PAGE_SIZE_DEFAULT`/`PAGE_SIZE_MAX`; no hardcoded `20`/`100`.
- [ ] `keysetBefore` lives in `adapters/postgres/scopes/` and is used by all four call sites.

### W7 — Interface width
- [ ] The six stale-scan methods collapse to one predicate-driven scan on `VideoRepository`.
- [ ] `core/ports/index.ts` no longer re-exports `../repositories/index`; imports updated.
- [ ] The 4 dead shims in `core/repositories/` are deleted.
- [ ] `metaValues` / `opts` removed from `InMemoryJobQueue`; Bull Board wiring lives in `adapters/bullmq/`;
      `queue-service.ts` no longer duck-types past the port.

### W8 — Hygiene, docs & tooling
- [x] `.claude/skills` registration in place; `improve-codebase-architecture` vendored; `ATTRIBUTION.md` updated.
- [x] The three stale `apps/web/.agents/skills/` entries removed.
- [x] One symlink script, deriving its list from disk; `packages/permissions` covered.
- [x] `docs/adr/` exists, or `docs/agents/domain.md` points at SDD §4 instead.
- [x] `packages/tsconfig/AGENTS.md`, `apps/web/AGENTS.md` and root `AGENTS.md` match reality.
- [x] `check_ci.py` and `scripts/remove-js-extensions.py` deleted; e2e wrapper chain collapsed.
- [x] CI turbo caches share a namespace or remote caching is enabled; `load-smoke.yml` no longer triggers on
      frontend-only changes and installs with `--frozen-lockfile` + cache.
- [x] `pnpm boundaries` is a CI check: `lint-typecheck` runs it as a named fail-fast step and again inside
      `pnpm typecheck`.

### W9 — Workspace layout & tier purity
- [ ] `core/` and `adapters/` live under `packages/<tier>/`; root `observability/` moved next to the code that
      validates it; `pnpm-workspace.yaml` contains globs only and `vitest.config.ts` has no one-off entries.
- [ ] Every shared package sits under `packages/universal/`, `packages/server/` or `packages/client/`, and the
      architecture suite asserts `vp.tier` equals the parent directory.
- [ ] `core` is split so the portable majority is `universal`: `@vp/domain` and `@vp/pagination` are
      universal; the driver ports and the repository interfaces they serve stay in a `server`-tier
      `@vp/core`, which keeps its name. No universal `@vp/contracts` — it would have no client consumer.
- [ ] The video/step/upload/rendition status vocabulary is declared **once**, in a universal package; the
      drizzle `pgEnum`, `core`'s unions and `@vp/api-contracts` all derive from it, and the drift test that
      was compensating for the missing seam is deleted.
- [ ] `adapters` and `packages/ffmpeg` are **not** split — each recorded as a deliberate decision with its
      reason, so the next reader does not re-litigate it.
- [ ] The tier has **one** source of truth: the directory. `vp.tier` survives only on `apps/*`, which sit
      outside `packages/<tier>/`; no package declares a tier its location contradicts.
- [ ] Importing a server package from `apps/web` **fails to resolve**, not merely fails a lint rule —
      demonstrated by adding such an import and pasting the error.
- [ ] `packages/api-contracts`' duplicate `decodeCursorPayload` is deleted and the one codec in
      `@vp/pagination` serves both sides.
- [ ] `packages/config` is split into a universal schema and a server loader; no `typeof process` guard
      remains in the universal half.
- [ ] No `universal` or `client` package declares a `server` package as a dependency — asserted from the
      manifest graph, not only from import statements.
- [ ] `apps/web`'s resolved runtime closure contains zero `server`-tier packages — asserted from the lockfile.
- [ ] Package **names** are unchanged; no source import specifier changed, only package locations.
- [ ] `pnpm test`, `pnpm test:bun`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and `make smoke-offline` green.

### Documentation (required by DoD)
- [ ] **`docs/SDD.md`**: §15.1 updated with the tier-scoped layout (W9), `api-contracts` / `api-client` and
      the tier column; **new ADR-23 "Package runtime tiers"** recording why the tier is a directory and
      not only a manifest field; ADR-20
      Consequences updated to name the enforcement suite; **new ADR-23 "Package runtime tiers"** recording the
      universal/server/client split; ADR-21 annotated to state that `apps/web` is pre-migration.
- [ ] **`ARCHITECTURE.md`**: §6 rewritten to reference `tests/architecture/`; the tier table added; Invariant 5
      updated to name the real packages.
- [ ] **`AGENTS.md`**: Rule 4 reconciled with `ARCHITECTURE.md`; a new rule for package tiers;
      `packages/permissions`, `api-contracts` and `api-client` added to the index.
- [ ] **`CONTEXT.md`**: add **Package Tier**, **Contract Package** and **Conformance Suite** to the glossary.
- [ ] **`README.md`** kept accurate for any changed command.
- [ ] `python3 docs/tickets/gen-index.py` re-run.

---

## Out of scope

- **The `apps/web` framework rewrite** (React 19, TanStack Start/Router/Query, Tailwind v4, Radix, hls.js,
  SSR, skeletons). Tickets 49–75 own that. This ticket makes the existing app talk to the real API over a
  single-sourced contract, under lint and typecheck. Swapping the framework on top of a correct contract is a
  smaller, safer change than doing both at once.
- Deploying `apps/web` (Dockerfile, compose service, k8s manifest). It has none today, and no other ticket
  covered it either — that gap is now [ticket 83](83-granular-container-topology-full-stack-deployment.md),
  which owns per-app images, a one-app-at-a-time dev loop and the orchestrated full-stack launch.
  **W3's local-first assertion must therefore check source, not runtime.**
- ~~Moving `core/` and `adapters/` under `packages/` (report candidate 8).~~ **Now in scope as W9.** W2's
  config changes made it cheap, which was the report's own stated condition. SDD §15.1 documents the current
  layout deliberately, so W9 updates §15.1 rather than contradicting it.
- Raising overall test coverage to the full 1:1 mandate. W3 lands the assertion; bringing 34% → 100% across
  169 source files is its own ticket. **Scope here: the assertion plus the files W1–W7 touch.**
- Reworking `packages/db/src/schema.ts` or any migration.

---

## Testing plan

- **Conformance:** one suite per repository port, executed against both adapters. This is the primary
  deliverable of W1 — the interface is the test surface.
- **Regression-first on the three defects:** each gets a test watched failing before the fix —
  feed sort/category divergence, the unawaited `authorize`, and the hardcoded external host.
- **Architecture suite:** every invariant gets a violating fixture proving the assertion fires.
- **Contract drift:** a route without an `@vp/api-contracts` entry fails the build.
- **Tier isolation:** a `universal` package importing `node:fs` fails to compile.
- **Frontend:** `<Can>` and `useCan` tested inside the real provider tree rather than in isolation; API calls
  tested against `@vp/api-contracts` shapes.
- **Dual runtime:** `pnpm test` and `pnpm test:bun` green (Rule 2).
- **Local-first:** `make smoke-offline` passes; the phone-home grep returns zero production hits.

---

## Notes for the implementer

- **Land W1 and W2 first.** They carry the three live defects. W3 then locks the result in.
- **Fix the class, not the instance.** Every workstream here exists because a one-off fix was applied where a
  shared owner was needed. Do not patch `listPublic` without landing the conformance suite; do not delete the
  `bullmq` line without landing tiers. The second copy is the moment to unify.
- **Deletion test before adding a seam.** Several findings are modules that only move complexity:
  `core/permissions`, `services/singleflight.ts`, the four `core/repositories` shims, `packages/db/src/repository`.
  Delete rather than restructure. One adapter is a hypothetical seam; two is a real one.
- **No extension point without a consumer.** `HttpCacheService` has 2 of 3 methods unused, `server.authorize`
  has zero callers, `QueueService` has 4 of 5 methods uncalled. Adopt or delete — do not preserve both.
- **Read the whole file you touch.** Most of these files carry more than the one issue named here.

---

## Definition of Done

- [ ] All nine workstreams merged, each as its own reviewed PR with green CI.
- [ ] The three live defects fixed, each with a test that was watched failing first.
- [ ] `pnpm test`, `pnpm test:bun`, `pnpm typecheck`, `pnpm lint` green with zero warnings — `apps/web` included.
- [ ] `make smoke-offline` passes; nothing phones home.
- [ ] `tests/architecture/` is a required CI check and every invariant it asserts is true.
- [ ] Documentation ACs above satisfied, including ADR-23.
- [ ] Ticket `**Status:**` set to `done` and `python3 docs/tickets/gen-index.py` re-run.

---

### Still open — why this ticket is not `done`

Every workstream's implementation is on `ticket/82-architecture-remediation`. This list is re-derived from
the tree rather than carried forward, so anything an earlier audit named and the tree no longer shows is
gone and is not repeated here: ADR-23 exists, `vp.tier` is off all 22 package manifests, `PageLimitSchema`
derives its bounds from `@vp/pagination`, and `apps/worker/src/runner.ts` no longer compares
`constructor.name`.

**Needs a decision, not just work**

1. **W2's `vp.tier` acceptance criterion contradicts what shipped.** Line 525 asks every `package.json` to
   declare `"vp": { "tier": ... }`. W9 made the directory the tier (ADR-23), and `scripts/check-boundaries.ts`
   now *rejects* the field on anything under `packages/<tier>/`; it survives only on the three `apps/*`
   manifests, which sit outside `packages/`. Amend the AC or revert the design — both cannot stand.
2. **`@vp/core` has two runtime dependencies** — `@vp/domain` and `@vp/permissions` — against the **zero**
   W2 asks for at line 529. Both arrived with the W9 split, which moved the portable 38 files out and left a
   package of ports and repository contracts expressed over that vocabulary. Decide whether the clause meant
   "no driver SDK reaches the browser through core" (satisfied) or literally zero, in which case core must
   stop leaning on `@vp/permissions`.
3. **File ceiling.** Seven production files still stand over the 400-line / 10 KB ceiling, so the W4 AC is
   unmet. All seven breach only the 10 KB half — the longest is `apps/worker/src/stages/transcode.ts` at 391
   lines. `packages/server/db/src/schema.ts` cannot be split under this ticket; reworking it is explicitly
   out of scope. The ceiling is machine-enforced against `tests/architecture/oversized-sources.ts`, a
   shrink-only list holding exactly those seven, so the number cannot grow; taking it to zero wants its own
   ticket alongside the 1:1 test backlog.

**Straightforward work**

4. **ADR-21 has no pre-migration annotation**, and SDD §15.1's tree still describes `apps/web` as
   "React 19 · TanStack Start/Router · Vite 6 · Tailwind v4" while the app is CRA 5 + React 18. The honest
   note exists in `ARCHITECTURE.md` and `apps/web/AGENTS.md`, not in the SDD.
5. **SDD §15.1 has no tier column.** Its tree carries the tier directories with a gloss on each, but §15.1
   holds no table at all — the first one below it belongs to §15.2 Toolchain.

**Process, not code**

6. **Nothing is pushed or merged.** All 80 commits sit on one local branch; the DoD asks for nine reviewed
   PRs with green CI.
7. **`pnpm lint` reports 70 warnings** (67 `noExplicitAny`, 3 `useSimplifiedLogicExpression`), against a DoD
   of zero. Most sit in `apps/worker` and `apps/api` specs; `apps/web` contributes one, a third-party
   children type in `drag-scroll-menu.tsx`.
8. **`make smoke-offline` has not been run** in this workstream — it needs Docker and the image set.
9. **The architecture suite is a CI step, not a *required* check.** `ci.yml` runs `pnpm test:architecture`,
   but `main` carries no branch-protection rule, and that is a GitHub setting rather than a file in this
   repository.
