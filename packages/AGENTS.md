# AGENTS.md — packages/ (Runtime Tiers & Dependency Layers)

Instructions for any coding agent adding to or changing a workspace package. This is the authoritative
reference for the two rules that govern every package in this repo; each tier directory has its own
`AGENTS.md` with the specifics, and each package has one of its own.

Every workspace package answers two independent questions. Both are machine-checked, and a wrong answer
fails the build rather than a review.

| Question | Property | Where it is declared |
|---|---|---|
| **Where may this code run?** | *tier* | the package's **directory** — `packages/universal/`, `packages/server/`, `packages/client/` |
| **Which way may dependencies point?** | *layer* | `vp.layer` in `package.json` |

They are orthogonal. A package can be `universal` and T1, or `server` and T3. Tier stops a Redis client
reaching the browser; layer stops the dependency graph turning into a ball of mud.

> Spec: [SDD ADR-23](../docs/SDD.md#adr-23-package-runtime-tiers-the-directory-is-the-tier) ·
> [ARCHITECTURE.md Invariant 5](../ARCHITECTURE.md) · checker: `scripts/check-boundaries.ts`

---

## 1. Tiers — where the code runs

| Tier | Directory | Runs in | May depend on |
|---|---|---|---|
| `universal` | `packages/universal/` | browser **and** server | `universal` only |
| `server` | `packages/server/` | Node / Bun only | `universal` + `server` |
| `client` | `packages/client/` | browser only | `universal` + `client` |

`server` and `client` are **siblings that can never see each other**. That is the whole point: there is no
path, direct or transitive, from `apps/web` to a server package.

Apps sit outside `packages/` because they are deployables, not libraries, so they declare their tier in
`package.json`: `apps/api` and `apps/worker` are `server`, `apps/web` is `client`.

### What makes a package `universal`

**A client consumer, not portability.** Plenty of code *could* run in a browser without any browser needing
it. `storage`, `job-contracts` and `events` were all once declared `universal` despite being imported only by
`apps/api` and `apps/worker` — and `job-contracts` carries `QUEUES = ['probe', 'transcode-1080p', …]`, BullMQ
queue names, which is backend vocabulary sitting in the browser-safe tier.

Ask: *does something client-side import this today?* If not, it is `server`. Declaring it `universal` "just in
case" weakens the signal and costs a real constraint (no `node:*`, no `@types/node`) for nothing.

And ask it of the *whole* package, not the one export the browser wants. `@vp/env-schema` was `universal`
because `apps/web` read `DEFAULT_API_BASE_URL` from it; `apps/web` now declares that default itself and the
package is `server`, where its Postgres, Redis, S3 and auth vocabulary belongs.

---

## 2. Layers — which way dependencies point

| Layer | Meaning |
|---|---|
| **T1** Foundation | No `@vp/*` dependency at all. The vocabulary everything else speaks. |
| **T2** Contracts and policy | Schemas and rules built on the foundation. |
| **T3** Domain capability | Ports and repository contracts, and the policy they lean on. |
| **T4** Integration | Concrete drivers and generated clients. |
| **T5** Application | Deployables. No library may depend on these. |
| **T6** Reference tool | Drives a running application from its acceptance suite. |

**The rule: dependencies point strictly down.** A T2 package may depend on T1 only — never on another T2, and
never upward.

**Sibling imports are forbidden**, and that is the part people find surprising. If `@vp/db` (T2) needs
`@vp/events` (T2), you may not simply add it. One of them is in the wrong layer, and you must say which.
Sibling edges are how a layer quietly becomes a cycle, and a cycle is what makes a monorepo impossible to
split, build incrementally, or reason about.

### Why the layer is declared, not computed

A tempting shortcut is to derive the layer as `1 + max(layer of dependencies)`. **Do not.** A derived depth
can never contradict itself — adding any edge just pushes the number up — so the check would always pass and
enforce nothing. The declared layer is a design statement; the checker's job is to catch the code disagreeing
with it.

---

## 3. The current map

Generated from the manifests. If this table and `package.json` disagree, the manifest wins and this document
is stale — fix it.

### T1 — Foundation (no `@vp/*` dependency)

| Package | Tier | Location |
|---|---|---|
| `@vp/domain` | universal | `packages/universal/domain` |
| `@vp/errors` | universal | `packages/universal/errors` |
| `@vp/result` | universal | `packages/universal/result` |
| `@vp/tsconfig` | universal | `packages/universal/tsconfig` |
| `@vp/concurrency` | server | `packages/server/concurrency` |
| `@vp/job-contracts` | server | `packages/server/job-contracts` |
| `@vp/logger` | server | `packages/server/logger` |
| `@vp/storage` | server | `packages/server/storage` |

### T2 — Contracts & policy

| Package | Tier | Depends on |
|---|---|---|
| `@vp/pagination` | universal | `@vp/errors`, `@vp/result` |
| `@vp/permissions` | universal | `@vp/errors` |
| `@vp/validation` | universal | `@vp/errors`, `@vp/result` |
| `@vp/compose-autoscaler` | server | `@vp/logger` |
| `@vp/composition` | server | `@vp/result` |
| `@vp/db` | server | `@vp/domain`, `@vp/errors`, `@vp/result` |
| `@vp/dev-token` | server | `@vp/logger` |
| `@vp/events` | server | `@vp/errors`, `@vp/job-contracts`, `@vp/result` |
| `@vp/ffmpeg` | server | `@vp/domain`, `@vp/errors`, `@vp/job-contracts`, `@vp/result` |
| `@vp/gen-video` | server | `@vp/logger` |
| `@vp/observability` | server | `@vp/result` |
| `@vp/testing` | server | `@vp/result` |

### T3 — Domain capability

| Package | Tier | Depends on |
|---|---|---|
| `@vp/api-contracts` | universal | `@vp/domain`, `@vp/errors`, `@vp/pagination` |
| `@vp/domain-rules` | universal | `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/result`, `@vp/validation` |
| `@vp/core` | server | `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/result` |
| `@vp/env-schema` | server | `@vp/domain`, `@vp/pagination`, `@vp/result` |

### T4 — Integration

| Package | Tier | Depends on |
|---|---|---|
| `@vp/api-client` | client | `@vp/api-contracts` |
| `@vp/adapters` | server | `@vp/composition`, `@vp/concurrency`, `@vp/core`, `@vp/db`, `@vp/dev-token`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/job-contracts`, `@vp/observability`, `@vp/permissions`, `@vp/result`, `@vp/storage` |
| `@vp/config` | server | `@vp/env-schema`, `@vp/logger`, `@vp/result` |

### T5 — Applications

| App | Tier | Depends on |
|---|---|---|
| `@vp/web` | client | `@vp/api-client`, `@vp/api-contracts`, `@vp/permissions`, `@vp/result` |
| `@vp/api` | server | `@vp/adapters`, `@vp/api-contracts`, `@vp/composition`, `@vp/concurrency`, `@vp/config`, `@vp/core`, `@vp/db`, `@vp/dev-token`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/logger`, `@vp/observability`, `@vp/pagination`, `@vp/permissions`, `@vp/result`, `@vp/storage`, `@vp/validation` |
| `@vp/worker` | server | `@vp/adapters`, `@vp/composition`, `@vp/config`, `@vp/core`, `@vp/db`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/ffmpeg`, `@vp/job-contracts`, `@vp/logger`, `@vp/observability`, `@vp/result`, `@vp/storage`, `@vp/validation` |

### T6 — Reference tools

| Package | Tier | Depends on | Dev-depends on |
|---|---|---|---|
| `@vp/upload-client` | server | `@vp/errors`, `@vp/logger`, `@vp/result`, `@vp/storage` | `@vp/adapters`, `@vp/api`, `@vp/core`, `@vp/dev-token` |

Its acceptance suite boots `apps/api` and a stub S3, so the package sits above the application it drives.
What it *ships* is four runtime dependencies; the layer records the whole manifest, dev edges included.

**Every package in `@vp/web`'s closure is `universal` or `client`** — six of them, counting what
`@vp/api-contracts` and `@vp/permissions` pull in, and it stays six once devDependencies count too. That is
the invariant the whole scheme exists to protect.
Verify it any time with `pnpm why bullmq` from `apps/web` — it returns nothing.

Membership is necessary and not sufficient: `@vp/env-schema` was `universal` while the browser imported one
constant from it, and the rest of the module — `DATABASE_URL`, `S3_SECRET_ACCESS_KEY`, `ADMIN_TOKEN`, the
BullMQ queue names — came along into `main.*.js`, because a tier rule cannot see inside a package it has
already allowed. It is `server` now, and `tests/architecture/frontend-vocabulary.test.ts` reads every source
the frontend can resolve for the same vocabulary.

---

## 4. How the boundary is enforced

Three mechanisms, strongest first. The first is the reason a violation is *impossible* rather than merely
discouraged.

### 4.1 It does not resolve — `error TS2307`

pnpm links only **declared** dependencies into a package's `node_modules`. A package that does not declare
`@vp/adapters` cannot resolve it, so the import is a TypeScript error at compile time:

```
src/rules/video.rules.ts(1,38): error TS2307: Cannot find module '@vp/adapters' or its
corresponding type declarations.
```

No lint rule, no plugin, no allowlist. The module is not there.

### 4.2 The build fails — `pnpm boundaries`

The remaining hole is someone *adding the declaration* to `package.json`. TypeScript cannot catch that, so
`scripts/check-boundaries.ts` does. It validates:

- tier compatibility of every `@vp/*` dependency, peerDependency and devDependency
- layer direction (strictly down; same-layer is a violation), over the same three groups
- the declared tier matches the directory the package lives in
- every `AGENTS.md` has its `CLAUDE.md` symlink

`pnpm build` and `pnpm typecheck` both run it **first**, so a bad manifest fails before turbo starts:

```
Package boundary violations (3):

  ✗ @vp/db (T2) depends on @vp/events (T2) — the same layer. Dependencies must point strictly down.
  ✗ @vp/permissions (universal) depends on @vp/adapters (server) — a universal package may only
    depend on universal
  ✗ @vp/permissions (T2) depends on @vp/adapters (T3) — a higher layer. Dependencies must point
    strictly down.
```

### 4.3 The type system — tsconfig presets

`@vp/tsconfig` exposes one preset per tier. `universal.json` and `client.json` set `lib` to include `DOM` and
`types` to `[]`, so a Node builtin or global in a `universal` package is a type error:

```
src/mime.ts(1,23): error TS2307: Cannot find module 'node:path'
src/mime.ts(3,20): error TS2591: Cannot find name 'process'
```

A subtlety worth knowing: `types: []` alone is not enough, because a spec doing
`import { describe } from 'vitest'` pulls `@types/node` into the whole program and `node:fs` starts resolving
again. Universal packages therefore exclude their specs from `tsconfig.json` and typecheck them through a
sibling `tsconfig.spec.json`.

`tests/architecture/package-boundaries.test.ts` asserts the same rules in the unit suite, so a violation also
shows up as a failing test.

---

## 5. Recipes

### Adding a package

1. Decide the **tier** by asking who consumes it. Client consumer → `universal` (or `client` if
   browser-only). Otherwise `server`.
2. Put it in `packages/<tier>/<name>`. The directory is the tier; there is no second place to declare it.
3. Decide the **layer**: one more than the highest layer it depends on. If that forces a sibling edge, the
   design is wrong — fix the dependency, not the number.
4. `package.json` gets `"vp": { "layer": ... }` - **not a `tier`**, the directory already fixes that and
   declaring one fails `pnpm boundaries`. `tsconfig.json` extends
   `@vp/tsconfig/<tier>.json`.
5. Write `AGENTS.md` and run `pnpm sync:claude` for the symlink.
6. `pnpm boundaries` must pass.

### "I need a server package from the frontend"

You do not. That dependency is the frontend needing **data, a contract, or a rule**, and each already has a
home: `@vp/api-contracts` for the shape, `@vp/api-client` for the call, and one of the two rule packages for
the rule.

**Which rule package is decided by what the function needs to be callable at all:**

| It needs | Package | Layer | Runs |
|---|---|---|---|
| the submitted input and nothing else | `@vp/validation` | T2 | in a form, before any network call |
| input **plus** an entity (`Video`, `Upload`, `UserContext`) | `@vp/domain-rules` | T3 | after a read, or against a cached entity |

There is no third answer, and `tests/architecture/validation-is-input-only.test.ts` tells you when you got it
wrong. The form layer depends on `@vp/validation` alone, which is what makes it *impossible* for a form to
reach a rule that needs a fetch - the reason these are two packages and not two folders.

`@vp/domain-rules` is **T3, not T2**, because it composes `@vp/permissions` and `@vp/validation`, which are
both T2, and a sibling edge is the violation §2 forbids. The layer is a design statement: rules sit above the
policy and the validation they compose.

### "Two packages need each other"

That is a cycle, and it means one of them is really two things. Extract the shared part downward into a lower
layer and have both depend on it. Do not add a sibling edge.

### Changing a package's tier

Move the directory, then run `pnpm install` and `pnpm boundaries`. There is no `vp.tier` to update. The move is deliberate by
design — a tier change should be a visible commit, not a one-word edit.

---

## 6. Where this is not enforced

Stated plainly so nobody assumes more coverage than exists:

- **Deep relative imports across package roots** (`../../other-package/src/thing`) bypass the manifest.
  Nothing in the repo does this today; it is not currently asserted.
- **Two packages are exempt from both rules as devDependencies**, named in `scripts/check-boundaries.ts`:
  `@vp/tsconfig` is a set of JSON presets and `@vp/testing` is a vitest config factory plus fixtures. Neither
  ships code, so neither can reach a runtime bundle. Every other devDependency is checked like a dependency —
  it resolves in CI, and a type it carries lands in the emitted `.d.ts` where `pnpm deploy --prod` cannot
  resolve it.
- **Bundler dead-code elimination is a declaration, not a guarantee.** Every browser-tier package that ships
  code sets `"sideEffects": false`, which is what lets webpack drop an unused export instead of keeping the
  whole module; `frontend-vocabulary.test.ts` asserts the declaration is there. It does not assert the
  bundler acted on it — grep the built `apps/web/build/static/js/main.*.js` if that is the question.
- **`tools/` has no tier**, because nothing in it is a package. Anything there that grows a `package.json`
  must move under `packages/<tier>/`.
