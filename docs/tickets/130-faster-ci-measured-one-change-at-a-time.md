# 130: Faster CI, measured one change at a time

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | None (can start immediately) |
| Blocks | — |
| Spec | [docs/standards/testing.md](../standards/testing.md) · [docs/standards/git-workflow.md](../standards/git-workflow.md) · [ci-shape.test.ts](../../tests/architecture/ci-shape.test.ts) |

**Status:** in-progress

> **Why.** Wall time of a CI run on `main` is a median 278 s (p90 340 s), and the critical path is `build` then
> `unit-bun`: 38 s plus 234 s. The budgets in `ci-shape-rules.ts` leave no room: `build` (2 min) plus `unit-bun`
> (6 min) is exactly the 8 minute `CRITICAL_PATH_MINUTES` ceiling, `unit` sits at 183 s median and 233 s at worst
> against 240 s, and an in-flight PR raises the visual and e2e budgets by about 50% instead of making them faster.
> Every ticket adds specs, so the budgets only move one way unless somebody measures what the time is spent on.
>
> The method comes from [AlexITC/expense-tracker](https://alexitc.com/blog/2026-10-23-from-27-minutes-to-4-cutting-ci-build-time-by-85-percent/),
> which went from about 27 to about 4 minutes by landing one measured change per PR (path-scoped jobs, one database
> container and one app per suite, a warm build server, dependency, generated-code and compiled-output caches,
> parallel tests scaled to the cores, cheap password hashing, a report rendered only on failure). The Scala and sbt
> specifics do not carry over; the discipline does: change one thing, compare the same step or the same build,
> keep it only when the number moved.

## Baseline

The 15 most recent successful runs of `ci.yml` on `main` that ran the heavy jobs (2026-10-26 and 27, pushes only; runs
that skipped them for a docs-only change are left out). A job's time is `startedAt` to `completedAt`, so runner queue
time is not in it. Collected with `gh run view <id> --json jobs`; the ticket's first acceptance criterion re-records it.

| Job | Median | p90 | Max | Budget | Where the median goes |
|---|---|---|---|---|---|
| build | 38 s | 68 s | 76 s | 2 min | `turbo run build` 11 s (41 s on a cache miss), workspace setup 14 s |
| lint-typecheck | 54 s | 98 s | 114 s | 3 min | setup 14 s, typecheck 13 s (49 s p90), architecture suite 10 s, knip 10 s |
| unit | 183 s | 225 s | 233 s | 4 min, and 240 s from its first step | vitest 150 s, setup 14 s, FFmpeg 8 s |
| unit-bun | 234 s | 286 s | 300 s | 6 min | `bun test` 184 s, setup 15 s, FFmpeg 9 s, the `--rerun-each 20` pair 7 s |
| integration | 102 s | 114 s | 119 s | 3 min | specs against real services 51 s, setup 12 s, compose up 8 s, migrate 7 s |
| e2e-smoke | 125 s | 140 s | 162 s | 4 min | image build 37 s, stack up 35 s, setup 13 s, smoke and browser 12 s |
| e2e-web | 70 s | 81 s | 82 s | 4 min | browser suite 34 s, setup 14 s, FFmpeg 9 s |
| e2e-studio | 56 s | 61 s | 63 s | 4 min | browser suite 19 s, setup 15 s, FFmpeg 9 s |
| visual-1 | 85 s | 157 s | 160 s | 4 min | shoot 35 s (86 s p90), setup 20 s, story tests 14 s, build workbench 7 s |
| visual-2 | 76 s | 126 s | 130 s | 4 min | shoot 31 s (85 s p90), setup 17 s, LFS checkout 6 s |
| terraform | 11 s | 14 s | 15 s | 2 min | |
| **Run wall time** | **278 s** | **340 s** | | 8 min chain | |

Critical path: `build` (38 s) then `unit-bun` (234 s) is 272 s of the 278 s. The next chains are `build` then `unit`
(221 s), then `e2e-smoke` (163 s), then `visual` (123 s median, 225 s p90 when a run shoots every story). Shortening
`unit-bun` alone moves the wall time only down to `unit`'s chain, so the first two items below land together.

Where the time goes outside the specs: workspace setup (14 to 20 s) is paid by nine jobs, the FFmpeg install
(8 to 9 s) by five, a total of about 200 job-seconds a run that no job shortens on its own.

## What applies here

| Technique | Verdict | Evidence |
|---|---|---|
| Path-scoped jobs | Partly done | `build` skips every heavy job for a docs-only change (`dorny/paths-filter`). Nothing scopes by area: a studio-only change still runs `unit-bun`, `integration`, `e2e-smoke` and `terraform`. |
| One shared DB container per suite | Done | `packages/server/adapters/__tests__/contract/pglite-snapshot.ts` migrates once per migration set and every file loads the snapshot. `integration` runs one compose stack for all files. |
| One app per suite | Mostly done | `buildTestApp`, `buildCommentsApp`, `buildLibraryApp` and `sharedCommentsApp` exist and about 45 api spec files build in `beforeAll`. Ten sites still build in `beforeEach` (for example `comments.test.ts`, `playlists.test.ts`, `recommendations.test.ts`, `preferences.test.ts`). Whether it matters is a measurement, not an assumption. |
| Warm build server | Done in effect | `turbo` replays `build` from a cache restored per commit, and `typecheck` keeps its own results cache; `vitest` keeps its spec durations so the slowest specs start first. |
| Dependency cache | Done | The pnpm store is restored by lockfile and `.nvmrc` and saved by `build` alone. Playwright's Chromium and FFmpeg's `.deb` files are cached. What is not measured is the install itself: 14 to 20 s a job. |
| Generated-code cache on its real inputs | Done | Video fixtures are keyed on the generator's source and manifest, Storybook on the source globs it reads, Terraform providers on the lock file. |
| Compiled-output cache, main saves and PRs restore | Not done | `build` and `lint-typecheck` save on every pull request, one key per commit. The per-commit key is needed to hand the build to the later jobs, but the typecheck results and the `type=gha` image caches are the part that can follow the rule. |
| Parallel tests scaled to the cores | Partly done | `unit` runs `--maxWorkers=4` on the four-core public runner, so it matches. `bun test` has no workers: one process runs about 700 files in turn. `integration` runs one file at a time by design (`fileParallelism: false`). |
| Cheap but real password hashing | No password hashing to cut | No `argon2`, `bcrypt`, `scrypt` or `pbkdf2` anywhere. The same cost exists for keys: `jwks-token-verifier.test.ts` generates RSA-2048 key pairs in nine places and `@vp/testing`'s `signingKey` does the same. |
| Test report only on failure | Mostly done | Playwright keeps its report and traces only `if: failure()`. The `unit` and `unit-bun` logs print every file; the architecture step prints a per-file timing table on every run. Small. |

## What to build

Ranked by expected saving. Each item is one change, one throwaway draft PR off `main`, measured on its own. The numbers
are estimates to rank by, not promises: the experiment replaces them.

1. **Split `unit-bun` into three shards by directory** (`apps/server/api`, `apps/server/worker`, and
   `packages/universal` plus `packages/server`), as a matrix like `e2e-client`. `bun test` runs files serially, so
   the job is one process: 184 s of tests over 152 + 57 + 498 files. Expected: tests fall to about 70 s a shard, the
   job to about 110 s with its 35 s of setup, so about 120 s off the critical path. Risk: each shard pays setup again
   (more runner minutes, free on a public repo); the `--rerun-each 20` pair moves into the shard that owns those two
   files. Measure: median `unit-bun` job time and wall time over five runs of the draft against five of `main`.
   First check whether Bun 1.4 has a sharding or worker flag of its own (`bun test --help`); it would replace the
   matrix.
2. **Split `unit` into two or three vitest shards** (`vitest run --shard=i/n` across the `projects`). Expected: tests
   150 s to about 80 s, job about 130 s. It only matters once item 1 lands, because `build` then `unit` (221 s) becomes
   the longest chain; ship the two together or the wall time barely moves. Risk: the spec-duration cache
   (`node_modules/.vite/vitest`) is keyed per run, so each shard needs its own key or the ordering degrades; sharding
   by file count is uneven when a few heavy specs dominate. Measure: slowest shard's tests step against the current
   `Run unit tests` step.
3. **Scope jobs by the area a pull request touches.** Let the `build` job's filter emit one output per area:
   `server` (apps/server, packages/server, packages/universal), `client` (apps/client, packages/client,
   packages/universal), `infra` (infra, scripts, Dockerfiles), and run `unit-bun`, `integration`, `e2e-smoke` and
   `terraform` only when their area changed. `main`, tags and the scheduled run always run everything. Expected: a
   client-only change skips `unit-bun` (234 s), `integration`, `e2e-smoke` and `terraform`; a server-only change
   skips `visual` and `e2e-client`. This saves runner time on most pull requests but not the worst-case wall time,
   which stays item 1's job. Risk: the highest of the list, a missed dependency edge lets a break through to `main`;
   derive the areas from the package tiers and layers (`vp.layer`) or from `turbo run --affected` instead of
   hand-written globs, and keep `universal` in both. A skipped required check reports as passed, so branch
   protection needs no change. Measure: job minutes per pull request over the last 30 merged PRs, replayed against
   the filter (a script over `gh pr view --json files`), plus a false-skip count of zero.
4. **Take the repeated per-job overhead down.** Three independent changes, three PRs: (a) restore a `node_modules`
   cache keyed on the lockfile and skip `pnpm install` on a hit, against the 14 to 20 s of the current store
   restore plus install; keep it only if restoring the directory is faster than installing from the store, which is
   not a given; (b) do not install FFmpeg in `unit`, `unit-bun`, `e2e-web` and `e2e-studio` when the fixtures came from the
   cache and no spec in the job spawns it (`video-fixtures` already installs it when it has to generate); (c) start the
   FFmpeg `.deb` restore and the fixture restore in parallel with the install. Expected: 8 to 9 s a job for (b), and
   about 5 to 10 s a job for (a), on the nine jobs. Measure: the same step in the same job, ten runs each.
5. **Stop the pull requests from saving compiled output they do not need.** `lint-typecheck` saves its typecheck
   results and `e2e-smoke` its image layers; make `main` the only saver (the `github.event_name != 'pull_request'`
   guard `e2e-smoke` already uses) and let pull requests restore with `restore-keys`. Expected: no change to a job's
   time, fewer evictions of `main`'s entries from the 10 GB cache, so fewer cold `build` runs (p90 68 s against a 38 s
   median). Measure: the share of runs where `Build every package once` ran longer than 30 s, before and after,
   over 20 pull requests; confidence is low until the eviction rate is known (`gh api repos/.../actions/cache/usage`).
6. **Start the images `e2e-smoke` needs while it builds.** `docker pull` the postgres, redis and minio images in the
   background at the job's start, as `visual` already does for Playwright's image; and check whether the 35 s
   `stack up` is health-check waiting that a tighter `healthcheck` interval removes. Expected: 10 to 20 s of the
   125 s. Not on the critical path, so only worth it after items 1 to 3. Measure: the `Start every app offline`
   step, ten runs each.
7. **Build the workbench and shoot only what the diff can move, on `main` too.** `visual` shoots every story on
   `main` (p90 157 s against a 85 s median where a pull request shoots a subset), and checks out with `lfs: true` and
   `fetch-depth: 0`. Try three shards on `main`, and replace the full-history checkout with a fetch of the base only
   (the list of changed files is all it reads). Expected: 20 to 40 s of the p90 and 3 to 5 s of the checkout.
   Measure: the `Shoot the stories` step on a run that shoots everything, before and after.
8. **Unit-suite hot spots, found by measurement.** Run `vitest run --reporter=json` and `bun test` with timings once
   on `main`, list the 20 slowest files, and fix each with the cheapest real change: build the app once in
   `beforeAll` and `.clear()` the in-memory repositories in `beforeEach` (ten api specs still build per test), and
   generate one signing key per file or use `ES256` or `EdDSA` where the algorithm is not what the spec tests
   (RSA-2048 generation is tens to hundreds of milliseconds a key and `jwks-token-verifier.test.ts` makes nine).
   The isolation these changes need already exists (`repositories.clear()`); the `unit` suite runs with
   `isolate: false`, so a spec that leaks module state breaks its neighbours, and each change gets a repeat run
   (`vitest --sequence.shuffle`) before it is kept. Expected: unknown until the list exists, probably 10 to 30 s of
   `unit`. Measure: the file's own duration, then the job.
9. **Test concurrency, only after isolation.** `bun test --concurrent` or a worker count above the core count only
   helps once the specs share no state; it cannot be isolated from item 8's findings and is measured last. Same for
   `integration`'s `fileParallelism: false`: it needs a database per file (a PGlite or a schema per worker) before
   turning it on. Expected: up to 30 s on `integration`, off the critical path. Not started before 1 to 3 are decided.
10. **Print less.** `--reporter=dot` (or `github-actions` only on failure) for `unit` and `unit-bun`, and drop the
    architecture timing table unless the budget fails. Expected: seconds at most; kept only if the log step shows a
    measurable difference, otherwise dropped.

Already free and staying as it is: the turbo cache is the local cache restored through `actions/cache`, so there is no
remote cache service to pay for or depend on; the pnpm store, Chromium, FFmpeg packages, fixtures, Storybook and
Terraform provider caches.

Constraints on every item:

- No paid infrastructure and nothing that needs an account (no Turbo remote cache, no larger hosted runners, no
  third-party cache service): [local-first](../LOCAL_FIRST.md) holds and `make smoke-offline` stays green.
- Coverage never drops, and the dual-runtime proof stays: the same specs still run under `vitest` and `bun test`, in
  full. A shard must be a partition of the same file set, checked by a count.
- `tests/architecture/ci-shape.test.ts` and `ci-shape-rules.ts` move with each kept change: `BUDGETS`,
  `SECOND_BUDGETS`, `CRITICAL_PATH_MINUTES` and the `unit-bun: does not set up Bun` style rules are lowered to what the
  change earned, never raised. Sharding `unit-bun` also needs the rule that reports a matrix job once per combination.
- No job's budget goes up in this ticket. The in-flight raise of the visual and e2e budgets is judged against item 7
  and item 6 before it merges.

## Delivery

The experiments are throwaway draft PRs and never merge. The keepers ship as at most one stack of three slices on
`feat/130-faster-ci` (`gh stack`):

1. The shards (items 1 and 2), with the `ci-shape` budgets and the matrix rule.
2. Path-scoped jobs (item 3) and the cache-saving rule (item 5).
3. Whatever else measured as a win (items 4, 6, 7, 8), folded by area.

## Acceptance criteria

- [ ] A baseline is recorded on `main` before any change: per-job and per-step median and p90 over at least 15 runs,
      plus the run wall time, with the script that produced it committed under `scripts/` so the later numbers come from
      the same query.
- [ ] Every candidate runs as its own draft PR cut from `main`, a handful at a time, never stacked on each other.
- [ ] Each result compares like with like: the same step, or the same full build, with at least five runs on each
      side, taken at similar load (not during a burst of other PRs). A result inside the run-to-run spread (the
      baseline's p90 minus median) is rerun until it is outside it or called no change.
- [ ] The PR for this ticket carries a results table, one row per candidate: change, before, after, saving,
      confidence, kept or dropped and why.
- [ ] Only the changes with a measured win are kept; the throwaway draft PRs of the rest are closed with their row.
- [ ] The run wall time on `main` after the stack is lower than the baseline median by at least the sum of the kept
      savings on the critical path, and `unit` and `unit-bun` each end under 70% of their budget, so a growing suite
      has room.
- [ ] `ci-shape.test.ts` holds the new, lower budgets and the matrix shape, and fails on a regression of each.
- [ ] A sharded job runs exactly the spec files of the unsharded run, no more and no fewer (the files counted in the
      PR), and the same suites still run under both `vitest` and `bun test`.
- [ ] No budget in `ci-shape-rules.ts` is higher than before; no paid service, account or network dependency is
      added; `make smoke-offline` passes.
- [ ] A pull request that touches one area runs only that area's jobs, and a `main` push, a tag and the scheduled run
      run every job (proved by `ci-shape` over the workflow, and by two real draft PRs).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, with output in the PR.

## Out of scope

- Paid or hosted infrastructure: larger runners, a Turbo remote cache service, a third-party build cache.
- Dropping a suite, a browser project or a runtime to save time; the dual-runtime proof and the jsdom runs stay.
- Loosening a budget, or raising one, to make a slow change pass.
- The load-smoke workflow ([k6](../../.github/workflows/load-smoke.yml)): it is nightly and path-scoped already.
- Rewriting specs for speed beyond the hot spots item 8 names.
- Production image build time (`images.yml`) and the cloud deploy.

## Testing plan

- The workflow shape: `ci-shape.test.ts` gains a bad-workflow finding for each new rule (a sharded `unit-bun` that
  loses a directory, a path filter that skips `main`, a budget raised, a pull request that saves a compiled-output
  cache), each as one `it.each` row.
- Partition: a script lists the files each shard runs and the test compares the union with the unsharded list.
- Measurement: the baseline script is run against the draft PRs' runs and its output pasted in the results table.
- Dual runtime: `pnpm test` and `pnpm test:bun` each run in full locally on the final branch.

## Open questions

- Does Bun 1.4 ship a sharding or worker option for `bun test`? If it does, item 1 is a flag and not a matrix.
- Is the scheduled run (`0 4 * * 1,4`) enough to keep `main`'s caches inside the seven-day eviction once pull requests
  stop saving (item 5)?
- Is `turbo run --affected` precise enough for item 3's areas, or do the tier and layer rules give a safer map?
- Does the in-flight pull request that raises the visual and e2e budgets by about 50% stay, once item 7 and item 6 are
  measured? Decide with the numbers, not before.

## Definition of Done

- [ ] All acceptance criteria proved with command output and the results table in the PR.
- [ ] The throwaway draft PRs are closed, each linked from its table row.
- [ ] `docs/standards/testing.md` states the new budgets and how a shard is added.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
