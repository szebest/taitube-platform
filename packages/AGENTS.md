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

> Spec: [SDD ADR-24](../docs/SDD.md#adr-24--tier-scoped-workspace-layout-the-directory-is-the-runtime-tier) ·
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

---

## 2. Layers — which way dependencies point

| Layer | Meaning |
|---|---|
| **T1** Foundation | No `@vp/*` runtime dependency. The vocabulary everything else speaks. |
| **T2** Contracts & domain capability | Schemas, rules, and capabilities built on the foundation. |
| **T3** Integration | Concrete drivers and generated clients. |
| **T4** Application | Deployables. Nothing may depend on these. |

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
| `@vp/pagination` | universal | `packages/universal/pagination` |
| `@vp/tsconfig` | universal | `packages/universal/tsconfig` |
| `@vp/config` | server | `packages/server/config` |
| `@vp/job-contracts` | server | `packages/server/job-contracts` |
| `@vp/observability` | server | `packages/server/observability` |
| `@vp/storage` | server | `packages/server/storage` |
| `@vp/testing` | server | `packages/server/testing` |
| `@vp/compose-autoscaler` | server | `packages/server/compose-autoscaler` |
| `@vp/dev-token` | server | `packages/server/dev-token` |
| `@vp/gen-video` | server | `packages/server/gen-video` |

### T2 — Contracts & domain capability

| Package | Tier | Depends on |
|---|---|---|
| `@vp/api-contracts` | universal | `@vp/errors`, `@vp/pagination` |
| `@vp/permissions` | universal | `@vp/errors` |
| `@vp/core` | server | `@vp/domain` |
| `@vp/db` | server | `@vp/config`, `@vp/errors` |
| `@vp/events` | server | `@vp/job-contracts` |
| `@vp/ffmpeg` | server | `@vp/errors`, `@vp/job-contracts` |
| `@vp/upload-client` | server | `@vp/errors`, `@vp/storage` |

### T3 — Integration

| Package | Tier | Depends on |
|---|---|---|
| `@vp/api-client` | client | `@vp/api-contracts` |
| `@vp/adapters` | server | `@vp/core`, `@vp/db`, `@vp/domain`, `@vp/errors`, `@vp/observability`, `@vp/permissions` |

### T4 — Applications

| App | Tier | Depends on |
|---|---|---|
| `@vp/web` | client | `@vp/api-client`, `@vp/api-contracts`, `@vp/permissions` |
| `@vp/api` | server | `@vp/adapters`, `@vp/api-contracts`, `@vp/config`, `@vp/core`, `@vp/db`, `@vp/dev-token`, `@vp/domain`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/observability`, `@vp/pagination`, `@vp/permissions`, `@vp/storage` |
| `@vp/worker` | server | `@vp/adapters`, `@vp/config`, `@vp/core`, `@vp/db`, `@vp/errors`, `@vp/events`, `@vp/ffmpeg`, `@vp/job-contracts`, `@vp/observability`, `@vp/storage` |

**Every package in `@vp/web`'s runtime closure is `universal` or `client`** — five of them, counting what
`@vp/api-contracts` and `@vp/permissions` pull in. That is the invariant the whole scheme exists to protect.
Verify it any time with `pnpm why bullmq` from `apps/web` — it returns nothing.

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

- tier compatibility of every `@vp/*` dependency and peerDependency
- layer direction (strictly down; same-layer is a violation)
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
4. `package.json` gets `"vp": { "tier": ..., "layer": ... }`, and `tsconfig.json` extends
   `@vp/tsconfig/<tier>.json`.
5. Write `AGENTS.md` and run `pnpm sync:claude` for the symlink.
6. `pnpm boundaries` must pass.

### "I need a server package from the frontend"

You do not. That dependency is the frontend needing **data or a contract**, and both already have a home:
`@vp/api-contracts` for the shape and `@vp/api-client` for the call. If the thing you want is a *rule* rather
than data — a validation, a policy, an enum — move that rule into a `universal` package and let both sides
import it. That is how `@vp/permissions` came to be shared.

### "Two packages need each other"

That is a cycle, and it means one of them is really two things. Extract the shared part downward into a lower
layer and have both depend on it. Do not add a sibling edge.

### Changing a package's tier

Move the directory, update `vp.tier`, run `pnpm install` and `pnpm boundaries`. The move is deliberate by
design — a tier change should be a visible commit, not a one-word edit.

---

## 6. Where this is not enforced

Stated plainly so nobody assumes more coverage than exists:

- **Deep relative imports across package roots** (`../../other-package/src/thing`) bypass the manifest.
  Nothing in the repo does this today; it is not currently asserted.
- **`devDependencies` are not tier-checked.** A server package may be a universal package's devDependency —
  test doubles and build tooling legitimately need this, and devDependencies never reach a runtime bundle.
- **`tools/` has no tier**, because nothing in it is a package. Anything there that grows a `package.json`
  must move under `packages/<tier>/`.
