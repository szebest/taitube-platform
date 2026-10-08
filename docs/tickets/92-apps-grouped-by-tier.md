# 92: Group apps by tier: apps/server and apps/client

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 47 - Multi-resource search engine · 53 - Frontend data layer · 54 - Frontend testing infrastructure · 55 - Design system · 75 - Playwright E2E suite · 83 - Granular container topology |
| Blocks | 48, 93 |
| Spec | [SDD ADR-11 Repository topology](../SDD.md#adr-11--repository-topology-modular-monorepo-multiple-deployables-one-worker-image) · [SDD ADR-20 Workspace boundaries](../SDD.md#adr-20--monorepo-topology-workspace-boundaries-and-contract-single-sourcing) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) |

**Status:** blocked

> **Priority: next.** Start as soon as the open PRs (#131, #133, #134, #135, #136, #132 and the deps PR) are
> merged, before any new FE ticket, to avoid big merge conflicts. 92 goes first, because
> [93](93-creator-studio-separate-app.md) depends on it.

> **Why.** `apps/` is flat today (`api`, `web`, `worker`), and [93](93-creator-studio-separate-app.md) adds a
> second frontend. `packages/` already answers "where does this run" with its directory (ADR-23); `apps/` should
> answer it the same way, so a second client app lands next to the first and the tier rule reaches the
> deployables too.

## What to build

Two PRs on two branches, in this order. The first is a move and nothing else; the second is the one code change
the move makes possible.

### 1. The move (PR 1, move-only)

```
apps/
├── server/               Node / Bun only, like packages/server
│   ├── api/              was apps/api
│   └── worker/           was apps/worker
└── client/               browser bundle, like packages/client
    └── web/              was apps/web (93 adds studio/ next to it)
```

- `git mv apps/api apps/server/api`, `git mv apps/worker apps/server/worker`, `git mv apps/web apps/client/web`.
  Whole folders, so every file stays byte-identical and keeps its history.
- Package names do not change (`@vp/api`, `@vp/worker`, `@vp/web`), so no import specifier, turbo filter or
  `pnpm --filter` changes. Only paths do.
- Every path that names `apps/*` changes in the same PR. The list below is what `main` held when this ticket
  was written, plus what the open PRs add. Re-run the grep after merging `main` and before pushing:

  ```
  git grep -n -E "apps/(api|web|worker)|apps/\*|'apps'|\"apps\"" -- . ':!docs/reviews' ':!pnpm-lock.yaml'
  ```

  | Where | What changes |
  |---|---|
  | `pnpm-workspace.yaml` | `'apps/*'` becomes `'apps/*/*'` |
  | `pnpm-lock.yaml` | importer keys, rewritten by `pnpm install`; never hand-edited |
  | `turbo.json` | `//#typecheck:repo` input `apps/*/src/**/*.ts` becomes `apps/*/*/src/**/*.ts`; the per-app `turbo.json` files move with their app |
  | `package.json` (root) | `test:bun` (`apps/api apps/worker`), `gen:contracts`, `db:migrate`, `db:seed` |
  | `apps/server/{api,worker}/package.json` | `dev` reads `--env-file-if-exists=../../.env`, now `../../../.env` |
  | `vitest.config.ts` | project glob `apps/*/vitest*.config.ts` becomes `apps/*/*/vitest*.config.ts` |
  | `knip.json` | workspace keys `apps/api`, `apps/worker`, `apps/web` |
  | `biome.json` | `apps/web/src/routeTree.gen.ts` (55 adds `apps/web/src/components/ui/design-system.css`) |
  | `tsconfig.repo.json` | nothing today (it includes `scripts` and `tests` only); check again after the merge |
  | `scripts/check-boundaries.ts` | `manifestDirs()` reads `apps/<name>`; it must walk `apps/<tier>/<name>`, or it finds no app manifest and passes while checking nothing |
  | `scripts/fairness-simulation.ts` | relative import `../apps/worker/...` |
  | `scripts/bundle-app.sh` (from 83) | `apps/web/...` and `apps/$app/...` |
  | `tests/e2e/in-process-env.ts`, `tests/e2e/dlq-checks.ts`, `tests/in-process/request-correlation.test.ts`, `tests/in-process/start-order.test.ts` | relative imports into `apps/api` and `apps/worker` |
  | relative paths out of an app (one more `../` each) | `apps/web/vite.config.ts` and `vite/__tests__/workspace-sources.test.ts` (`packages`), `apps/api/src/gen-contracts.ts` and `composition/__tests__/openapi-document.test.ts` (repo root), `apps/api/src/__tests__/k6.test.ts` (`tests/load`, `tools/chaos`), `apps/worker/src/__tests__/registry.test.ts` (`infra/k8s`), `apps/worker/src/stages/__tests__/{probe,segment-uploader,thumbnail}.test.ts` (`tests/fixtures`) |
  | `tests/architecture/entrypoints.ts` | every `apps/api/src/...`, `apps/worker/src/...` and `apps/web/src/config/index.ts` row (83 adds one) |
  | `tests/architecture/repo-files.ts`, `repo-files.test.ts` | the `apps/**` globs and the `apps/api/src/main.ts` sample |
  | `tests/architecture/test-correspondence.test.ts`, `env-confinement.test.ts`, `sdk-confinement.test.ts`, `spec-discipline.test.ts`, `esm-specifiers.test.ts`, `no-process-comments.test.ts`, `core-barrels.test.ts` | `trackedFiles('apps', ...)` still works; the hard-coded file rows and `apps/web/...` excludes do not |
  | `tests/architecture/zero-matches-rows.ts`, `zero-matches-web-rows.ts`, `zero-matches.test.ts` | every scope row under `apps/...`, and `':(exclude,glob)apps/*/.claude/skills'`, which becomes `apps/*/*/.claude/skills` |
  | `tests/architecture/env-key-closure.test.ts`, `in-memory-off-boot-path.test.ts` | the manifest regex `^(apps\|packages\/\w+)\/[\w-]+\/package\.json$` becomes `^(apps\|packages)\/\w+\/[\w-]+\/package\.json$`; as written it silently stops matching every app |
  | `tests/architecture/env-keys.ts` | the compose `dockerfile: apps\/` match (83 rewrites it) |
  | `tests/architecture/` path constants | `adapter-instantiation`, `drain-before-close`, `env-keys-consumed`, `error-vocabulary` (`apps\/(api\|worker)`), `lockfile-closure`, `frontend-vocabulary`, `load-smoke-triggers`, `local-first`, `messages-are-client-only`, `no-adhoc-formatting`, `no-domain-throw`, `no-truthy-result`, `no-tuning-literals`, `routes-unwrap-at-send-result`, `route-plugins`, `shutdown-closure`, `total-dependencies`, `workspace-closure`, `doc-commands` (`apps/*/package.json` workspace glob and its fixtures), `program.ts` |
  | `packages/server/testing/src/__tests__/index.test.ts` | `PACKAGE_PARENTS` lists `'apps'`; it becomes `'apps/server'` and `'apps/client'` |
  | `.github/workflows/ci.yml` | the route tree drift check (`apps/web/src/routeTree.gen.ts`) and the `--rerun-each 20` segment-uploader path |
  | `.github/workflows/images.yml` | the Dockerfile paths, or whatever 83 leaves (83 moves to one root `Dockerfile`) |
  | `.github/workflows/load-smoke.yml` | `paths:` filter `apps/api/**`, `apps/worker/**` (held by `load-smoke-triggers.test.ts`) |
  | `.github/BRANCH_PROTECTION.md` | `apps/worker` |
  | `docker-bake.hcl`, `infra/compose/docker-compose.yml` | Dockerfile paths on `main`; after 83 they point at the root `Dockerfile` and may need nothing, so check |
  | `infra/k8s/` | no app path on `main` (`apps/v1` is the API group, not a path); `infra/k8s/AGENTS.md` names `apps/worker/...registry.test.ts` |
  | `infra/terraform/outputs.tf` | two token descriptions naming `apps/api` and `apps/worker` |
  | `packages/server/env-schema/src/platform-env.json` | the `WORKER_RUNTIME` description names `apps/worker/Dockerfile` |
  | `.env.example` | the comments naming `apps/api`, `apps/worker`, `apps/web` |
  | Makefile | nothing on `main`; 75 adds e2e targets, check after the merge |
  | `.agents/skills/vp-work-ticket/SKILL.md`, `.agents/skills/hexagonal-port-adapter/SKILL.md` | `apps/worker` |
  | `CLAUDE.md` symlinks | each app's `CLAUDE.md -> AGENTS.md` is relative and moves with the folder; `pnpm sync:claude` then `pnpm boundaries` proves nothing drifted |
  | docs a reader follows | root `AGENTS.md` (the directory index and rule 4's `apps/api/src/composition/...`), `ARCHITECTURE.md`, `docs/SDD.md` (ADR-11, ADR-20, ADR-21, ADR-23, §15.1 tree, the `CORS_ORIGINS` row), `README.md`, `CONTEXT.md`, `docs/standards/*`, `docs/runbooks/*`, every package `AGENTS.md` and `README.md` that names an app, and the three app `AGENTS.md` files (their `../../docs/...` links gain a `../`) |
  | `docs/tickets/` | open tickets that still say `apps/api`, `apps/worker` or `apps/web` (the in-flight ones were left alone when 92 was written); run `python3 docs/tickets/gen-index.py` |

- Leave as written: `docs/reviews/*` and tickets already `done`. They record what the repo looked like at the
  time.

### 2. The tier rule reaches the apps (PR 2)

- `scripts/check-boundaries.ts`: `directoryTier()` reads `apps/(server|client)/` as well as
  `packages/(universal|server|client)/`, so an app's tier is its directory, like a package's.
- `vp.tier` goes from the three app manifests; the existing "declares vp.tier, but its directory is the tier"
  error now covers apps too. An app outside `apps/server/` or `apps/client/` fails `pnpm boundaries`.
- The rule this gives: a client app depends on `universal` and `client` packages only, a server app on
  `universal` and `server` only. Same table as `TIER_MAY_IMPORT`, nothing new to maintain.
- `tests/architecture/package-boundaries.test.ts` gets a case per new failure: an app under `apps/` with no
  tier directory, and a client app that depends on a server package.
- ADR-23 ("Apps sit outside `packages/` and declare their tier"), `packages/AGENTS.md` §1 and
  `ARCHITECTURE.md` Invariant 5 say the directory is the tier for apps too.

## Acceptance criteria

- [ ] `git log --follow --oneline -- apps/server/api/src/main.ts`, `apps/server/worker/src/main.ts` and
      `apps/client/web/src/router.tsx` show history from before the move (pasted in PR 1).
- [ ] `git diff -M --summary origin/main...HEAD` on PR 1 prints only `rename ... (100%)` lines for files under
      `apps/`, and `git diff -M --stat` shows the rest as small path-only edits.
- [ ] `pnpm test` reports the same number of test files and tests before and after PR 1 (pasted). A glob that
      stopped matching an app would drop its specs silently; this is the check that catches it.
- [ ] `pnpm boundaries` lists the same package count as before the move, apps included.
- [ ] `git grep -n -E "apps/(api|web|worker)\b" -- . ':!docs/reviews' ':!pnpm-lock.yaml'` returns only done
      tickets and this one.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm knip`,
      `pnpm knip --production`, `pnpm boundaries`, `pnpm gen:contracts` (no diff) and `python3
      docs/tickets/gen-index.py --check` green.
- [ ] `pnpm --filter @vp/web build` still writes the route tree with no drift; `pnpm dev` starts api, worker
      and web.
- [ ] The images build (`docker buildx bake` or what 83 leaves) and `make smoke-offline` passes.
- [ ] PR 2: `pnpm boundaries` fails on a client app that depends on a server package and on an app outside
      `apps/<tier>/` (specs in `package-boundaries.test.ts`); no app manifest declares `vp.tier`.

## Out of scope

- Renaming packages (`@vp/*` stays; [48](48-project-rebrand-cli-unification.md) owns the rebrand).
- Any change inside an app beyond the forced relative paths. Restructuring `src/` belongs to the feature
  tickets.
- The studio app: [93](93-creator-studio-separate-app.md).

## Notes for the implementer

- **Sequencing.** This move conflicts with every open PR that touches `apps/*`. It lands in a quiet window,
  after the open stack has merged: #131 (54), #133 (53), #135 (75), #136 (55) on the web side, #132 (83),
  #134 (47) and the deps PR on the server side. Any other PR open at that point (today #137 and #139 touch
  `apps/api` and `tests/architecture`) merges first or rebases after. Merge `main` into the branch
  immediately before the move commit, push, and ask for a fast review; a day of drift means redoing the grep.
- Do the `git mv` as its own commit, then the path edits as a second commit, so a reviewer can read the second
  one alone.
- After 83 the images come from one root `Dockerfile` that prunes by package name, so most of the Docker side
  may need no edit. Check `scripts/bundle-app.sh`, which copies by path.
- `git merge` with rename detection carries most open-branch edits across the move. A branch that added new
  files under `apps/web/` after this lands should merge `main` and check where its new files ended up.

## Open questions

- Decided: `apps/server` and `apps/client`, not `apps/backend` and `apps/frontend`, to match the package tiers.
  The directory already means "where this code may run" in `packages/`, so `apps/client/web` reads the same way
  as `packages/client/api-client`, and `pnpm boundaries` can use one tier table for both. `apps/client/web`
  runs an SSR server in Node; its tier still says what it may import (universal and client only), which is
  what `vp.tier: "client"` says today.
- Decided: two PRs. The `git-and-pr-conventions` rule is that a move ships alone; the tier check is a code
  change, so it follows in its own PR.

## Definition of Done

- [ ] PR 1 is move-only: its own commit and its own PR, holding only `git mv` and the path edits the move
      forces. No file or symbol rename, no code edit, no refactor riding along; anything else goes in another
      PR.
- [ ] Whole folders moved, so files stay byte-identical: `git diff -M --summary` prints only `rename ...
      (100%)` lines plus the path-only edits.
- [ ] No unplanned restructure added to a PR under review.
- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `ARCHITECTURE.md`, `docs/SDD.md` and every `AGENTS.md` that names an app path updated in PR 1; ADR-23 and
      `packages/AGENTS.md` updated for the tier rule in PR 2.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
