# Testing Standards & Strategy

How the `video-pipeline` specs are layered, where each kind runs, and the rules every spec is held to. Every
rule below that can be checked by a machine is, and the check is named next to it.

---

## 1. Layers

```
                  +--------------------------------+
                  |    E2E & Smoke Verification    |  (Docker Compose / Offline)
                  +--------------------------------+
                  |   Integration (real services)  |  (Postgres, Redis, MinIO)
                  +--------------------------------+
                  | Deterministic Unit Test Suites |  (doubles, PGlite)
                  +--------------------------------+
```

### Unit (`pnpm test:unit`, the `unit` CI job)
- Domain services, routes, worker stages, adapters and the web app, against the in-memory doubles in
  `packages/server/adapters/in-memory` and, for the Postgres repositories, PGlite.
- No Docker, no network. A spec that needs a server binds port `0` (`listen({ port: 0 })`), never a port it
  picked and then released.
- The doubles own their state and expose `.clear()`.
- The client specs run the React Compiler's output, as the apps ship it: every client Vitest project builds with
  `reactPlugins()` from `@vp/vite-preset`. Two more projects, `ui (jsdom, uncompiled)` and
  `studio (jsdom, uncompiled)`, run only the `*.differential.dom.test.tsx` specs (Field, Tabs, Select, Dialog,
  the studio upload dialog) without it; each records the DOM and a handler trace at every step into one
  committed snapshot, so a miscompile fails one of the two runs. `*.renders.dom.test.tsx` specs (Field, Tabs,
  Select) count a part's commits with `createRenderCounter` from `@vp/web-testing/dom` while the root re-renders
  with the same props; they prove what the compiler memoizes, so they run compiled only and fail without it.
- `pnpm test:coverage` runs the same projects with v8 coverage and prints a summary (`coverage/`, gitignored). It is a measurement, not a gate: CI does not run it, and the unit job keeps its time budget.

### Integration (`pnpm test:integration`, the `integration` CI job)
- Runs against real services: the job starts Postgres, Redis and MinIO with Docker Compose, migrates the
  database, and reads their URLs through `loadEnv()` (`tests/integration/use-real-services.ts`).
- It runs the **same contract specs** as unit, with the real service as the subject: the 12 Postgres
  repository specs, and the Redis, S3 and BullMQ adapter specs (`tests/integration/vitest.config.ts`).
- A spec there that would fall back to PGlite or a double fails instead: the setup fails any file in which no
  contract claimed a real service, and a service that is not reachable fails the file.
- A measurement is not a gate: `*.perf.test.ts` specs stay out of every CI run and run on demand with
  `pnpm --filter @vp/adapters test:perf` (the fingerprint lookup against 10 000 videos, its 200 ms
  figure); the integration run keeps a 500-video variant of the same query path.
- `make test-r2` runs the S3 contracts against the R2 bucket the `S3_*` variables you export name.

### End to end
- `make smoke` and `make smoke-offline` against the Compose stack, `E2E_REDUCED=true pnpm e2e` (or
  `make e2e`) for the in-process acceptance suite. Every fixture the e2e specs read comes out of a plain
  `pnpm gen-video` (`tests/in-process/e2e-fixtures.test.ts`).
- `pnpm --filter @vp/web test:e2e` and `pnpm --filter @vp/studio test:e2e` (or `make e2e-web`, `make e2e-studio`,
  the `e2e-web-1`, `e2e-web-2`, `e2e-studio-1` and `e2e-studio-2` checks of the `e2e-client` CI job, each app's suite
  in two Playwright shards) for each client app's Playwright suite in its
  `e2e/`, against the same in-process stack plus that app built and served. The stack fixture, the config
  factory and the security suites both import live in `tests/playwright/`. The specs are held to the spec
  discipline below, apart from the Vitest rules. Where a page ticket adds its flows:
  [apps/client/web/AGENTS.md](../../apps/client/web/AGENTS.md) Rule 10.

---

## 2. Contracts: one per port, run from each implementation's own spec

A port or repository with more than one implementation has one contract, `describeXContract(subject)` in
`packages/server/adapters/__tests__/contract/`. Every implementation file has its own spec beside it that runs
the contract against itself:

- `in-memory/repositories/__tests__/in-memory-video-repository.test.ts` runs the video contract against the
  double
- `postgres/repositories/__tests__/postgres-video-repository.test.ts` runs it against PGlite in unit and
  against Postgres in integration (`postgresSubject()` picks)
- the Redis, S3 and BullMQ adapter specs run the cache, storage, multipart, queue and flow contracts the same
  way, against the double in unit and the real service in integration

A double that drifts from the real thing fails the shared contract assertion in its own spec. The contracts
live in `@vp/adapters` rather than `@vp/testing`, because `@vp/testing` depending on `@vp/core` would make a
workspace cycle (every package dev-depends on `@vp/testing`).

Each Postgres spec file gets a PGlite of its own, loaded from one migrated snapshot the adapters project
builds in its global setup (`__tests__/contract/pglite-snapshot.ts`): a fresh PGlite runs initdb, most of a
second, and one loaded from the snapshot starts in about a tenth of that. The engine is truncated between
tests, not rebuilt.

---

## 3. Time is injected

- A stage or adapter that waits takes a clock (`now: () => number`) or a scheduler (`every: Every`, the type
  `Heartbeat`, `OutboxRelay` and `StreamingSegmentUploader` take), and the spec drives it.
- Otherwise `vi.useFakeTimers()` and `vi.advanceTimersByTime` / `advanceTimersByTimeAsync`. Bun's `vi` has
  both, but not `vi.setSystemTime`, so a spec that also runs under Bun injects the clock instead.
- No fixed sleep (`setTimeout` inside a `new Promise`, `setImmediate` as a wait, a `sleep` / `settle` /
  `delay` helper) and no assertion on elapsed wall-clock time. A spec waits for the thing itself: a promise
  the code returns, a deferred it resolves, `onJobCompleted`.

The e2e runners are the exception by nature: they poll a deployed stack on its own clock.

---

## 4. Spec discipline

`tests/architecture/spec-discipline.test.ts` reads every spec and test helper and fails on:

- a runtime import from `vitest` (`describe`, `it`, `expect`, `vi` are globals; `import type` is fine)
- a timer wait or a sleep helper (section 3)
- `Date.now() - start` or `performance.now() - start` on a snapshot the spec took
- `typeof import(...)` or `importOriginal<...>`: mock a module as
  `vi.mock(import('x'), async (importOriginal) => ({ ...(await importOriginal()), y: vi.fn() }))`
- two tests with the same full title (describe titles plus the test's own) in one file
- a `console` call
- `.skip`, `.only`, `.todo`, `skipIf`, `runIf`

Sibling tests that differ only by input are one `it.each`.

Every test config restores spies and stubbed env vars before each test (`restoreMocks`, `unstubEnvs` in
`definePackageTestConfig`, and in the configs that do not use it; `@vp/testing`'s own spec holds every project
config to it). Bun reads no vitest config, so `bunfig.toml` preloads `tests/bun-restore-mocks.ts`, which does
the same after each test. No spec needs an `afterEach` to undo a spy.

Each project config chooses its own pool and isolation, because a project config inherits nothing from the root
`vitest.config.ts`: `pool: 'threads'` and `isolate: false` (`definePackageTestConfig` sets both, `clientAppTestConfig`
in `@vp/vite-preset` sets them per project for the client apps, and no command line passes `--pool`). `architecture-typed` runs on
one fork in `sequence.groupOrder` 1 and `architecture` on two threads in group 2, both after every other
project's group 0: Vitest 5 gives a group one `maxWorkers` and batches a project into a single task only at one
worker, so that is how the typed specs build their `ts.Program` once. The files of one project share a worker
and its module cache, which is most of what makes `unit` fit its budget. A spec therefore leaves no module state
behind: state lives in what `beforeEach` builds, not at module level, and a mock of a package outlives the file
that registered it, so a helper that mock reads from keeps its state where every file sees the same copy
(`apps/client/web/src/__tests__/live-page.ts`). The exception is every jsdom project that renders with Testing
Library, the client apps' and `@vp/intl-react`'s (`isolate: true`): Testing
Library registers its automatic cleanup once per module load, so a jsdom file that shared a worker with another
would keep the previous test's DOM. The e2e and integration configs (`tests/vitest.config.ts`,
`tests/integration/vitest.config.ts`, `packages/server/ffmpeg/integration.config.ts`) are not root projects and
run on Vitest's defaults.

---

## 5. Shared fixtures

`@vp/testing` owns what more than one package needs: `definePackageTestConfig`, `SEEDED` (the users, channels
and videos the in-memory repositories and the development seed start with), `createMockJob`, `withEnv`,
`expectOk` / `expectErr` (`@vp/testing/result`), log capture and `runEntrypoint` (a TypeScript entrypoint in a
child of the runtime the spec runs on). A spec that acts as "the dev user" names `SEEDED.userId`; the literal
never appears in a spec (`zero-matches`).

What needs a higher layer lives in the app that owns it: the API's test app is `buildTestApp` in
`apps/server/api/src/__tests__/test-app.ts`, the worker's harness is in `apps/server/worker/src/__tests__/`, and the
client apps share `@vp/web-testing`: an MSW server whose handlers are typed from `@vp/api-contracts`
(`createEndpointMocks`), `serverRender` for the server's answer, `renderRoute` for a route in the browser and
`stubBrowser` for a node spec; what one app alone needs (`renderPage`, `signIn`) stays in its `src/__tests__/`.
Each client app runs two Vitest projects, `node` and `jsdom` (the `*.dom.test.{ts,tsx}` specs);
[apps/client/web/AGENTS.md](../../apps/client/web/AGENTS.md) Rules 7 and 9 show how to write a route spec.

---

## 6. Dual runtime

Worker code and every `universal` and `server` package run on Node 24 and Bun 1.4, so their specs pass under
both:

```bash
pnpm test       # Vitest (Node.js)
pnpm test:bun   # Bun, over apps/server/*, packages/universal and packages/server
```

No `Bun.*` API in source. Bun is a test runtime only; every repo script runs on `tsx`.

`pnpm test:bun` leaves out `packages/client/`: those packages are browser-only, so no runtime parity is at
stake, and their specs lean on what only Vitest offers (jsdom, `vi.mock(import(...))`). It also skips every
`__tests__/integration/` folder, which a package's vitest config leaves to the `integration` job too: real
encodes or real services, not a parity question.

---

## 7. Commands

| Scope | Command |
|---|---|
| Every Vitest project | `pnpm test` |
| Unit, as CI runs it (no architecture suite) | `pnpm test:unit` |
| The architecture invariants | `pnpm test:architecture` |
| Real services | `pnpm test:integration` |
| On-demand measurements | `pnpm --filter @vp/adapters test:perf` |
| Bun parity | `pnpm test:bun` |
| One package | `pnpm --filter @vp/adapters test`, any package name in place of `adapters` |
| Smoke against Compose | `make smoke`, `make smoke-offline` |
| In-process acceptance suite | `make e2e` |
| Browser suites (Playwright) | `make e2e-web`, `make e2e-studio` |
| The web click path's speed (CLS and its shift source, long tasks, the worst interaction, a palette keystroke) | `pnpm perf:clicks before`, then `pnpm perf:clicks after --against before` |

A package's specs run only if the root `vitest.config.ts` `projects` globs reach its `vitest*.config.ts`.
After adding one, check the file count in the `pnpm test` summary went up.

`turbo.json` tasks hash the whole package. Do not narrow them to `src/**`: `adapters/` and `core/` keep their
source in `postgres/`, `ports/`, `repositories/`, so a `src/**` filter matches nothing for them and every run
replays a cached pass. `pnpm typecheck --force` bypasses the cache.

---

## 8. One spec per source file

Every source with runtime code has `__tests__/<same-name>.test.ts` (or `.tsx`, or `.dom.test.ts(x)` for a web
spec that runs under jsdom) beside it, in every tier, `apps/client/web` included. A module that erases to nothing (types, interfaces, an abstract class of abstract
members, with or without doc comments) needs none; `tests/architecture/runtime-code.ts` decides by
transpiling it. One spec never covers several sources. `tests/architecture/test-correspondence.test.ts` is a
flat assertion with no exception list.

---

## 9. CI budgets, shards and retries

Each job's `timeout-minutes` in `.github/workflows/ci.yml` is its outer bound, and three test steps carry their
own budget through `.github/actions/budget`: `unit-tests` 240 s in each unit shard, `architecture` 30 s in
`lint-typecheck` (the suite's own time from its JSON report) and `integration-tests` 240 s.
`tests/architecture/ci-budget-rules.ts` holds the numbers: `build` 3, `lint-typecheck` 4, `unit-shards` 5,
`unit-bun-shards` 4, `integration` 6, `e2e-smoke` 4, `e2e-client` 4, `visual` 5, `terraform` 2, the two
aggregates 1, and 9 minutes for the longest `needs` chain. A budget names the step it measures by its `id`, and its
limit sits below its job's `timeout-minutes`, so the budget fires first and names the step.

`unit` (vitest, `--shard=i/N`, N derived below) and `unit-bun` (`bun test --shard=i/3`) are matrix jobs named `unit-shard-<i>` and
`unit-bun-shard-<i>`. Two one-step jobs named `unit` and `unit-bun` follow them, fail unless every shard passed
and print which shard did not, so the required checks in branch protection keep their names. Vitest assigns spec
files to shards by their recorded cost, not by a hash of the path: `scripts/timings/sequencer.ts` reads
`tests/timings/unit.json` (milliseconds per spec file: environment, import and tests) and deals the files out
longest first, each to the cheapest shard so far; a file with no entry costs the median. The two suites that
repeat 20 times under Bun run in `unit-bun-shard-1` only.

The vitest shard count is derived, not set. The `build` job runs `pnpm unit-shards --github-output`, which reads
`tests/timings/unit.json` and plans the fewest shards whose expected wall time stays under 150 s each
(`ceil(total cost / (150 s * 3.2))`, 3.2 being the cost-seconds one shard runs per wall second at `--maxWorkers=4`,
measured). It exposes `unit-shards` (the matrix) and `unit-shard-count` (the `/N`), which `unit-shards` reads;
`ci-shape` fails a hand-set matrix or denominator. The 150 s target leaves 40% under the 240 s budget.

### Budgets, shards and retries: when to change what

- **The formula.** A limit is the smallest round number (10 s for a step, a whole minute for `timeout-minutes`) at
  or above 1.5 times the p90 of its successful runs, with no run at or above 85% of it. Measure with
  `pnpm ci:health --branch all --runs 200`, table 3 (every budget of `ci.yml`, its median, p90, max and the runs
  inside 15% and 10% of the limit), over runs of the current shard count only.
- **Raise a budget** when `ci-health` reports a run of it at or above 85% of its limit, and only by the formula
  over the measured window, in a PR that says the window and the numbers. Never to make one change pass: a change
  that slows a step by itself is a regression to fix. Lower one when the formula says so.
- **Regenerate the timings** (`pnpm timings:update --run <id> --run <id>`, two or more green runs, which it
  averages) when the shards' summed cost drifts apart, when a large spec moved or `unit-timings.test.ts` fails on a
  spec file older than 7 days that the file does not list. The sequencer balances recorded cost to within 1%;
  what remains between shards is the runner (the same files run 0.8 to 1.15 times their recorded cost on different
  hosted runners).
- **Add specs freely; never add a shard by hand.** The shard count follows from `tests/timings/unit.json`
  (`pnpm unit-shards` prints it), so a suite that grows gets more shards once its timings are refreshed. A new spec
  costs the median until then. Refresh with `pnpm timings:update --run <id> --run <id>`; `refresh-unit-timings.yml`
  also does it every Monday (or on `workflow_dispatch`) from the last two green `main` runs and opens a pull
  request, which needs "Allow GitHub Actions to create and approve pull requests" on; close and reopen it to run CI
  on it. Do not raise the 240 s budget when a shard misses it: refresh the timings, or lower the target in
  `scripts/timings/plan-shards.ts` if the measured parallelism fell.
- **One retry, and a pass on it fails the job.** CI retries a failed test once (`--retry=1` for vitest,
  `retries: 1` under `CI` for Playwright and the visual suite), so the report tells a flaky test from a broken
  one. A test that passes on its retry leaves a `passed on retry` error naming the spec and the test, a table in
  the job summary, `ci-health` counts it as a flip, and `scripts/retried/publish.ts` fails the run.
- **Quarantine** a flaky spec only while it is being fixed: add `{ spec, owner, reason, expires, ticket }` to
  `tests/quarantine.json` (at most five, `quarantine.test.ts` fails an incomplete or expired entry). CI skips it
  (`pnpm quarantine` prints the vitest `--exclude`, `tests/playwright/config.ts` ignores it) and the nightly
  `flake-hunt.yml` keeps running it. The hunt runs every Playwright spec ten times and the jsdom specs three times,
  files one `Flaky spec: <path>` issue per spec that failed, and fails on one the quarantine does not list.
- **A jsdom test ends once its requests settle**: `@vp/web-testing` waits for the requests a test left in flight
  before it drops the test's handlers, and an unanswered request names the contract to mock
  (`mock it with mockEndpoint(getPreferences, ...)`); answer it in the app's one loader API helper.

### Flaky tests: root-cause, do not retry

A spec that fails on one run and passes on the next has a cause in the spec or the code: find it and fix it. A
raised timeout, a retry, a sleep or a skip hides it and a later run finds it again; a quarantine (below) only
buys the time to fix it.

- **A test ends once its work has.** Every client app's jsdom project runs `@vp/web-testing/settle.setup` last:
  before it unmounts, it waits for the fetching queries and pending mutations of every mounted `QueryClient`, and
  for every `renderRoute` router, to go idle, and fails the test with what is still running after 5 s. A test
  that holds a request on purpose releases it before it ends (`heldReply`); an upload it starts, it finishes or
  cancels. Testing Library's own cleanup is off there (`RTL_SKIP_AUTO_CLEANUP`), since it would unmount first.
- **A React update after the test ended fails that test** by name (`LeakedUpdateError`). Left alone it surfaces
  after jsdom's teardown as `window is not defined`, in whichever file ran last on that worker.
- **A request after the test ended** fails as `UnhandledRequestError ... from "<the test that made it>"`.
- **Wait for the thing itself** (section 3), never for a proxy that settles earlier: a recorded request is not
  its handled answer, a server-rendered text is not a hydrated page (`hydrated(locator)` in
  `tests/playwright/fixtures.ts`), an open room socket is not its preview, and a performance entry's `element` is
  `null` once hydration replaced the node.
- **No state shared between tests.** The e2e stack is one per run and its personas outlive a test: a spec that
  changes what a persona sees signs in as `stranger`, a viewer no other test shares.
- **Prove a fix by repetition**: the spec 100 times or more, in parallel and under CPU load (Playwright's
  `--repeat-each`, copies of a vitest spec), before and after, with both pass rates in the PR.

`pnpm ci:health` (`scripts/ci-health.ts`, the nightly `ci-health.yml`) prints green first time per branch, failures
per job, every budget's margin, flips and passes on retry, merges behind main or merged red (`--merges`) and the
causes of every failed job by the rule table in `scripts/ci-health/causes.ts` (`--causes`); `--json <file>` keeps
the report, `--check` exits non-zero below the thresholds (main green first time 95%, flips under 2%, no run within
15% of a limit).

`pnpm ci:timings` (`scripts/ci-timings.ts`) prints the per-job and per-step median, p90 and max of `ci.yml`
runs, `--branch <name>` for the last runs of a branch and `--runs <id>,<id>@<attempt>` for chosen ones. Measure a
CI change with it against the same query on `main`, at least five runs on each side, and rerun a result that
falls inside the baseline's median-to-p90 spread.
