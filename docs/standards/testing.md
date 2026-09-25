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

### Integration (`pnpm test:integration`, the `integration` CI job)
- Runs against real services: the job starts Postgres, Redis and MinIO with Docker Compose, migrates the
  database, and reads their URLs through `loadEnv()` (`tests/integration/use-real-services.ts`).
- It runs the **same contract specs** as unit, with the real service as the subject: the 12 Postgres
  repository specs, and the Redis, S3 and BullMQ adapter specs (`tests/integration/vitest.config.ts`).
- A spec there that would fall back to PGlite or a double fails instead: the setup fails any file in which no
  contract claimed a real service, and a service that is not reachable fails the file.
- `make test-r2` runs the S3 contracts against the R2 bucket the `S3_*` variables you export name.

### End to end
- `make smoke` and `make smoke-offline` against the Compose stack, `E2E_REDUCED=true pnpm e2e` (or
  `make e2e`) for the in-process acceptance suite. Every fixture the e2e specs read comes out of a plain
  `pnpm gen-video` (`tests/in-process/e2e-fixtures.test.ts`).

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

The root run does not isolate spec files (`isolate: false` in `vitest.config.ts`): the files of one project
share a worker and its module cache, which is most of what makes `unit` fit its budget. A spec therefore
leaves no module state behind: state lives in what `beforeEach` builds, not at module level, and a mock of a
package outlives the file that registered it, so a helper that mock reads from keeps its state where every
file sees the same copy (`apps/web/src/__tests__/stored-value.ts`).

---

## 5. Shared fixtures

`@vp/testing` owns what more than one package needs: `definePackageTestConfig`, `SEEDED` (the users, channels
and videos the in-memory repositories and the development seed start with), `createMockJob`, `withEnv`,
`expectOk` / `expectErr` (`@vp/testing/result`), log capture and `runEntrypoint` (a TypeScript entrypoint in a
child of the runtime the spec runs on). A spec that acts as "the dev user" names `SEEDED.userId`; the literal
never appears in a spec (`zero-matches`).

What needs a higher layer lives in the app that owns it: the API's test app is `buildTestApp` in
`apps/api/src/__tests__/test-app.ts`, the worker's harness is in `apps/worker/src/__tests__/`.

---

## 6. Dual runtime

Worker code and every shared package run on Node 24 and Bun 1.4, so their specs pass under both:

```bash
pnpm test       # Vitest (Node.js)
pnpm test:bun   # Bun, over apps/api, apps/worker and packages
```

No `Bun.*` API in source. Bun is a test runtime only; every repo script runs on `tsx`.

`pnpm test:bun` skips one set of files by name: the `.test.tsx` specs of `@vp/intl-react`, which render
React through Testing Library under jsdom, and Bun ships no DOM. That package is browser-only, so no
runtime parity is at stake; its pure `resolve-locale.test.ts` still runs under both.

---

## 7. Commands

| Scope | Command |
|---|---|
| Every Vitest project | `pnpm test` |
| Unit, as CI runs it (no architecture suite) | `pnpm test:unit` |
| The architecture invariants | `pnpm test:architecture` |
| Real services | `pnpm test:integration` |
| Bun parity | `pnpm test:bun` |
| One package | `pnpm --filter @vp/adapters test`, any package name in place of `adapters` |
| Smoke against Compose | `make smoke`, `make smoke-offline` |
| In-process acceptance suite | `make e2e` |

A package's specs run only if the root `vitest.config.ts` `projects` globs reach its `vitest*.config.ts`.
After adding one, check the file count in the `pnpm test` summary went up.

`turbo.json` tasks hash the whole package. Do not narrow them to `src/**`: `adapters/` and `core/` keep their
source in `postgres/`, `ports/`, `repositories/`, so a `src/**` filter matches nothing for them and every run
replays a cached pass. `pnpm typecheck --force` bypasses the cache.

---

## 8. One spec per source file

Every source with runtime code has `__tests__/<same-name>.test.ts` (or `.tsx`) beside it, in every tier,
`apps/web` included. A module that erases to nothing (types, interfaces, an abstract class of abstract
members, with or without doc comments) needs none; `tests/architecture/runtime-code.ts` decides by
transpiling it. One spec never covers several sources. `tests/architecture/test-correspondence.test.ts` is a
flat assertion with no exception list.
