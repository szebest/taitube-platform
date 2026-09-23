# Architecture: Ports & Adapters (Hexagonal Architecture)

This document describes the architectural boundaries, ports, and adapters layer in the `video-pipeline` monorepo.

---

## 1. Architectural Principles

1. **Dependency Inversion:** High-level policy (domain services, routes, worker pipeline stages) must never import, instantiate, or depend directly on low-level details (concrete SDKs like `@aws-sdk/client-s3`, `ioredis`, `bullmq`, or Postgres/Drizzle drivers).
2. **Ports as Abstract Classes:** Every boundary is defined by an abstract class in `@vp/core/ports`. Abstract classes are used instead of pure TypeScript interfaces to allow `instanceof` checks, centralized error wrapping, and runtime health check contract enforcement.
3. **Single Injection Seam:** Concrete adapters are instantiated exclusively at composition roots (`apps/api/src/app.ts` and `apps/worker/src/runner.ts`) and injected down into domain services and worker stage processors.
4. **Interface Segregation:** Distinct responsibilities are separated into dedicated ports rather than god-objects:
   - Standard object operations live in `StorageClient`; multi-part lifecycle operations live in `MultipartStorage`.
   - Low-level database connection/transaction execution lives in `DatabaseClient`; domain entity data access lives in dedicated domain repositories (`VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`, `CategoryRepositoryPort`, `VideoReactionRepositoryPort`).
5. **Modular Single-File Repository Design:** Each repository implementation has its own separate file in `repositories/`, adhering to single responsibility and clean file sizing (target <= 250 lines).
6. **First-Class In-Memory Test Doubles:** Every port provides an in-memory adapter implementing realistic behavior (CAS transitions, fencing token validation, multipart chunk assembly, pub/sub simulation). All unit tests execute entirely in-memory with zero Docker, network sockets, or external dependencies.

---

## 2. Directory Layout

Shared code sits under `packages/<tier>/`, where the directory **is** the runtime tier (Invariant 5).

```
video-pipeline/
├── apps/
│   ├── api/                        # Fastify API — composition root apps/api/src/app.ts
│   ├── worker/                     # BullMQ worker — composition root apps/worker/src/runner.ts
│   └── web/                        # Taitube web client (React 18 + CRA today; tickets 49-75 own the rewrite)
│
├── packages/universal/             # runs in a browser AND on a server
│   ├── api-contracts/              # @vp/api-contracts — every endpoint schema, one entry per route
│   ├── domain/                     # @vp/domain — entities, value objects, status vocabulary, ranking policy
│   ├── env-schema/                 # @vp/env-schema — the zod environment schema, no process access
│   ├── errors/                     # @vp/errors — domain and RFC 9457 error classifications
│   ├── pagination/                 # @vp/pagination — the one keyset Paginator and cursor codec
│   ├── permissions/                # @vp/permissions — the pure CASL authorization engine
│   └── tsconfig/                   # @vp/tsconfig — base / server / universal / client / spec presets
│
├── packages/client/                # browser only
│   └── api-client/                 # @vp/api-client — typed client generated from @vp/api-contracts
│
├── packages/server/                # Node/Bun only
│   ├── core/                       # @vp/core — abstract driver ports and repository interfaces
│   │   ├── ports/                  # authorization, cache-client, database-client, flow-producer,
│   │   │                           #   health-checkable, job-queue, multipart-storage, reaction-cache,
│   │   │                           #   storage-client, subscription-cache
│   │   └── repositories/           # one interface per domain entity + the aggregating container
│   ├── adapters/                   # @vp/adapters — the only home of concrete driver SDKs
│   │   ├── authorization/          # CaslAuthorizationAdapter (@vp/permissions bridge)
│   │   ├── postgres/               # Drizzle repositories, mappers/, scopes/ (CASL AST -> SQL, keyset)
│   │   ├── s3/                     # S3StorageClient & S3MultipartStorage (@aws-sdk/client-s3)
│   │   ├── redis/                  # RedisCacheClient, category/reaction/subscription caches, singleflight
│   │   ├── bullmq/                 # BullMqJobQueue, BullMqFlowProducer, Bull Board wiring
│   │   └── in-memory/              # autonomous test doubles for every port
│   ├── config/                     # @vp/config — the server loader over @vp/env-schema
│   ├── db/                         # @vp/db — Drizzle schema, client, migrations, seeds
│   ├── events/                     # @vp/events — event definitions and the Redis pub/sub dispatcher
│   ├── ffmpeg/                     # @vp/ffmpeg — argument builders, progress parsers, probe helpers
│   ├── job-contracts/              # @vp/job-contracts — BullMQ payload schemas and queue names
│   ├── observability/              # @vp/observability — OpenTelemetry, Prometheus, Pino
│   ├── storage/                    # @vp/storage — S3 object key layout
│   ├── testing/                    # @vp/testing — shared vitest config, fixtures, assertion helpers
│   └── dev-token/ gen-video/ upload-client/ compose-autoscaler/   # developer CLIs
│
└── tests/
    ├── architecture/               # the executable form of section 5 — see section 6
    └── e2e/                        # the acceptance runner
```

---

## 3. Core Ports & Repositories

### `HealthCheckable`
```typescript
export interface HealthCheckable {
  checkHealth(): Promise<boolean>;
}
```
All ports extend `HealthCheckable` to ensure uniform liveness and readiness monitoring across all external integrations.

### `DatabaseClient`
Low-level client for executing parameterized queries, transactions, and health checks:
- `query<T>(queryText, params?)` / `execute(queryText, params?)`
- `transaction(fn)` / `checkHealth()` / `close()`

### Domain Repositories (`@vp/core/repositories`)
- **`VideoRepository`**: `findById`, `findWithDetails`, `create`, `updateMetadata` (optimistic version check), `transition` (atomic CAS with events).
- **`UploadRepository`**: `findById`, `findByVideoId`, `findWithVideo`, `create`, `updateStatus`.
- **`StepRepository`**: `claim`, `complete`, `fail` (worker fencing tokens), `heartbeat`, `findByVideoId`.
- **`RenditionRepository`**: `create`, `findByVideoId`, `update`.
- **`EventRepository`**: `create`, `findByVideoId`.
- **`UserRepository`**: `findById`, `upsert`.
- **`CategoryRepositoryPort`**: Category listing, caching, admin management.
- **`VideoReactionRepositoryPort`**: Atomic reaction recording and counter synchronization.
- **`Repositories`**: Aggregating container interface bundling domain repositories.

### `AuthorizationPort`
Abstracts user authorization and declarative rule evaluation. It answers the verdict; the refusal is a
rule's, through `authorize(actor, allowed, context)` in `@vp/domain-rules` (ADR-24):
- `getAbility()`: returns the active `@casl/ability` instance.
- `can(action, subject)` / `can(helper, params)`: evaluates if an action is permitted.
- `forUser(user)`: returns a new `AuthorizationPort` instance scoped to the target user.

### `StorageClient`
Abstracts standard S3-compatible object storage operations across local MinIO and Cloudflare R2:
- `uploadObject(options)` / `downloadObject(bucket, key, targetFilePath)` / `headObject(bucket, key)`
- `deleteObject(bucket, key)` / `getObject(bucket, key)`
- `createPresignedPutUrl(params)`

### `MultipartStorage`
Abstracts multi-part uploads with part-level presigning and listing:
- `createMultipartUpload(bucket, key, contentType)`
- `createPresignedPartUrl(params)`
- `listMultipartParts(bucket, key, uploadId)`
- `completeMultipartUpload(bucket, key, uploadId, parts)`
- `abortMultipartUpload(bucket, key, uploadId)`

### `CacheClient`
Abstracts key-value caching and Pub/Sub messaging:
- `get(key)` / `set(key, value, ttlSeconds?)` / `del(key)`
- `publish(channel, message)` / `subscribe(channel, handler)` / `unsubscribe(channel)`

### `JobQueue` & `FlowProducer`
Abstracts job queuing, lifecycle, and parent-child flows:
- `add(name, data, options?)` / `process(handler, options?)`
- `getJobCounts()` / `getJobs(types)`
- `addFlow(flow)`

---

## 4. Adapters (`@vp/adapters`)

| Port / Boundary | Production Adapter | In-Memory Adapter |
|-----------------|--------------------|-------------------|
| `AuthorizationPort` | `CaslAuthorizationAdapter` | `PermissiveAuthorizationAdapter` / `StrictAuthorizationAdapter` |
| `DatabaseClient` | `PostgresDatabaseClient` | `InMemoryDatabaseClient` |
| `Repositories` | `PostgresRepositories` | `InMemoryRepositories` |
| `StorageClient` | `S3StorageClient` | `InMemoryStorageClient` |
| `MultipartStorage` | `S3MultipartStorage` | `InMemoryMultipartStorage` |
| `CacheClient` | `RedisCacheClient` | `InMemoryCacheClient` |
| `JobQueue` | `BullMqJobQueue` | `InMemoryJobQueue` |
| `FlowProducer` | `BullMqFlowProducer` | `InMemoryFlowProducer` |

---

## 5. Architectural Invariants

### Invariant 1: Dedicated Repository Files
- Every repository implementation MUST live in its own dedicated file inside `repositories/` subfolders:
  - `packages/server/adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `packages/server/adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Monolithic multi-repository files are strictly forbidden.

### Invariant 2: File Length & Sizing Discipline
- Target size: `<= 250 lines` of code per file.
- Strict limit: `400 lines` or `10 KB` per file, asserted by `tests/architecture/file-ceiling.test.ts`
  against a shrink-only exception list (section 6).
- See [docs/standards/file-discipline.md](docs/standards/file-discipline.md).

### Invariant 3: Autonomous In-Memory Test Doubles
- In-memory test doubles manage self-contained state and expose `.clear()`.
- Repositories interact exclusively via port interfaces, never by reaching into foreign private collections.

### Invariant 4: Deep Domain Services vs Thin Transport Routes
- Route handlers in `apps/api/src/routes/` are strictly thin HTTP transport adapters.
- Domain workflows and invariants live in deep domain services in `apps/api/src/services/`.
- Every route module is a Fastify plugin that reads its services from `app.services` and is registered
  from the one table in `apps/api/src/routes/index.ts`.
- See [apps/api/AGENTS.md](apps/api/AGENTS.md).

### Invariant 5: Package Runtime Tiers & Dependency Layers

Every workspace package answers two independent questions, and both are machine-checked.

**Where may this code run?** That is the *tier*, and it is the package's location on disk:

```
packages/universal/   runs in a browser AND on a server
packages/server/      Node/Bun only
packages/client/      browser only
```

| Tier | Packages | May depend on |
|---|---|---|
| `universal` | `api-contracts`, `domain`, `domain-rules`, `errors`, `pagination`, `permissions`, `result`, `tsconfig`, `validation` | `universal` only — no `node:*`, no server SDK |
| `server` | `adapters`, `composition`, `compose-autoscaler`, `concurrency`, `config`, `core`, `db`, `dev-token`, `env-schema`, `events`, `ffmpeg`, `gen-video`, `job-contracts`, `observability`, `storage`, `testing`, `upload-client` | `universal` + `server` |
| `client` | `api-client` | `universal` + `client` |

Apps sit outside `packages/` and declare their tier in `package.json`: `apps/api` and `apps/worker` are
`server`, `apps/web` is `client`.

A package is `universal` only when something client-side actually consumes it. `storage`, `job-contracts`
and `events` were once declared universal despite having no client consumer — `job-contracts` carries BullMQ
queue names, which is backend vocabulary sitting in the browser-safe tier. Tier follows consumers, not
portability.

**Which way may dependencies point?** That is the *layer*, declared as `vp.layer`:

```json
"vp": { "layer": 2 }
```

| Layer | Meaning | Packages |
|---|---|---|
| T1 | Foundation — no `@vp/*` dependency | `domain`, `errors`, `result`, `tsconfig`, `compose-autoscaler`, `concurrency`, `dev-token`, `gen-video`, `job-contracts`, `observability`, `storage` |
| T2 | Contracts and policy | `composition`, `db`, `events`, `ffmpeg`, `pagination`, `permissions`, `testing`, `validation` |
| T3 | Domain capability — ports, repository contracts, rules and the configuration value | `api-contracts`, `core`, `domain-rules`, `env-schema` |
| T4 | Integration — concrete drivers, generated clients and the env loader | `adapters`, `api-client`, `config` |
| T5 | Applications | `apps/api`, `apps/worker`, `apps/web` |
| T6 | Reference tools whose acceptance suite drives a running application | `upload-client` |

**Dependencies point strictly down.** A T2 package may depend on T1 only — never on another T2, and never
upward. Sibling imports are forbidden because they are how a layer quietly becomes a cycle. The layer is
*declared*, not derived from the graph: a derived depth can never contradict itself, which would make the
check vacuous.

**`devDependencies` count.** A test-only edge still resolves in CI, and a type it carries still lands in the
emitted `.d.ts`, where `pnpm deploy --prod` will not be able to resolve it. The two exceptions are named in
`scripts/check-boundaries.ts`: `@vp/tsconfig` (JSON presets) and `@vp/testing` (a vitest config factory and
fixtures) ship no code, so nothing they are named by can reach a runtime bundle.

#### How the boundary is enforced

Three mechanisms, strongest first:

1. **It does not resolve.** pnpm links only declared dependencies, so importing a package you did not declare
   is `error TS2307: Cannot find module '@vp/adapters'` at compile time. This is what makes a server import in
   the frontend impossible rather than merely discouraged.
2. **The build fails.** `pnpm boundaries` (`scripts/check-boundaries.ts`) validates tier compatibility, layer
   direction and tier-vs-directory agreement across every manifest, over dependencies, peerDependencies and
   devDependencies alike. Both `pnpm build` and `pnpm typecheck` run
   it first, so a bad *declaration* — the one thing TypeScript cannot catch — fails before turbo starts.
3. **The type system.** The matching `@vp/tsconfig` preset gives `universal` and `client` packages `lib` with
   `DOM` and `types: []`, so a Node builtin or global is a type error. Specs run under
   `@vp/tsconfig/spec.json` via a package's own `tsconfig.spec.json`, so importing `vitest` cannot leak
   `@types/node` back into the package's program.

`tests/architecture/package-boundaries.test.ts` asserts the same rules in the unit suite — see section 6.
Full reference, including the per-package map and the recipes: [packages/AGENTS.md](packages/AGENTS.md).

- `apps/web` must NEVER import `@vp/core`, `@vp/adapters`, `@vp/db` or any `server` package.
- The frontend talks to the backend only through `@vp/api-contracts` and `@vp/api-client`.
- For all frontend architectural patterns, see [apps/web/AGENTS.md](apps/web/AGENTS.md).

### Invariant 6: Deterministic Test Suite Parity
- Every production source with runtime code has a spec of the same name beside it in `__tests__/`,
  asserted by `tests/architecture/test-correspondence.test.ts` against a shrink-only exception list
  (section 6). A module that erases to nothing - types, interfaces, an abstract class of abstract members -
  is not a target: its spec could only assert that TypeScript compiles.
- No heuristic skips: test suites never swallow connection errors or skip assertions conditionally.
- Strict 1:1 parity between local developer environments and remote CI pipelines.
- Unit tests execute against in-memory doubles; database durability tests execute against PostgreSQL.
- See [docs/standards/testing.md](docs/standards/testing.md).

---

### Invariant 7: Results at the Domain Seam

A failure is part of every signature below the edge. Domain code returns `Result<T, E>` from `@vp/result`
instead of throwing it (SDD ADR-24), and only two places unwrap one: `sendResult` in `apps/api/src/routes/`
and `runner.ts` in `apps/worker`, which converts through `RETRY_CLASS` because BullMQ's retry contract *is*
the exception.

- **Rules are pure and universal.** `@vp/validation` (T2) sees the submitted input and nothing else;
  `@vp/domain-rules` (T3) sees input plus an entity plus policy. Neither awaits, logs, formats or throws.
- **Absence is not a failure.** `findById` answers `ok(null)`. Whether a missing row is an error belongs to
  the rule that asked, not the store that looked.
- **`catch` is confined to the boundary that converts a throw** - `tryCatch` / `fromPromise` in `@vp/result`
  and the adapters that call them at the exact line the SDK is called.
- **The discriminant is the existing `ErrorCode`**, so no second error vocabulary appears. `PROBLEM_STATUS`
  and `RETRY_CLASS` are both total over it.

Authority: [docs/standards/error-handling.md](docs/standards/error-handling.md).

---

### Invariant 8: Configuration Is a Value, Dependencies Are Total

Both deployables build one object graph from one `Container` (`@vp/composition`, SDD ADR-25) over one
`AppConfig` value, and nothing below the composition modules reaches around it.

- **`process.env` is read where a process starts.** `loadEnv()` in `@vp/config` parses it once at
  `apps/*/src/main.ts`; `toAppConfig()` in `@vp/env-schema` shapes it for consumers. Services, stages and
  adapters take configuration as a value.
- **The schema is closed in both directions.** Every key the deployables read is declared, every declared
  key is in `.env.example`, and every key compose, the k8s base, CI and `make` hand to this code is declared.
- **`AdapterKind` is the one environment switch.** `registerAdapters(c, config)` in `@vp/adapters` picks the
  in-memory or external family from `config.kind` and imports only that family.
- **Dependencies are total.** A service or stage never constructs, defaults or infers a collaborator it was
  not handed; forgetting one in a composition module is a compile error.
- **A concrete adapter is constructed only in a composition module** or inside `@vp/adapters` itself.
- **No secret-shaped key has a default**, and a production boot refuses a missing or placeholder one.

### Invariant 9: A Process Drains Before It Closes

- `buildApp()` / `createWorkerRunner()` construct; `container.start()` runs I/O. A test that builds the app
  opens no subscription and leaves no timer.
- On `SIGTERM`/`SIGINT` both processes run `shutdownOnce` from `@vp/composition`: readiness flips first,
  the listener keeps accepting for the drain delay, then the server closes and the container disposes in
  reverse construction order. A close that outlives the grace window is abandoned and the pending disposer
  is named in the log.
- Every resource a composition module constructs registers a disposer.
- `terminationGracePeriodSeconds`, the `preStop` hook, compose's `stop_grace_period` and each process's
  grace window are derived from one another (SDD ADR-25).

## 6. Verification & Enforcement

Every invariant in section 5 is an assertion in `tests/architecture/`, run by `pnpm test:architecture`
(≈1.5 s, no build) and again inside `pnpm test`. CI runs it as a named fail-fast step in `lint-typecheck`,
before lint and typecheck. **An invariant that cannot be asserted is deleted from this document rather than
left as decoration** — a rule a human has to remember to check is a rule that has already drifted.

| Assertion | Holds | Fixture that proves it fires |
|---|---|---|
| `package-boundaries.test.ts` | a package under `packages/<tier>/` takes its tier from that directory and must not declare `vp.tier`; everything else must; `universal` never depends on `server`; dependencies point strictly down, devDependencies included | a manifest that declares a tier its directory already fixes |
| `sdk-confinement.test.ts` | `@aws-sdk/*`, `ioredis`, `bullmq`, `postgres` and `drizzle-orm` are imported only under `packages/server/adapters/` and `packages/server/db/`, and **declared** in no other manifest; `@vp/adapters` is imported only from a composition module | `import { Queue } from 'bullmq'` in `apps/api/src/app.ts`; `import { CaslAuthorizationAdapter } from '@vp/adapters'` in a service |
| `lockfile-closure.test.ts` | `apps/web`'s resolved runtime closure holds no `server`-tier package — read from the lockfile, so a transitive edge is caught too | a `server` package linked into a `universal` package two hops from `apps/web` |
| `local-first.test.ts` | no production source names an off-machine host; every uncommented `.env.example` default is local | a hardcoded `https://…onrender.com` |
| `file-ceiling.test.ts` | no production source over 400 lines or 10 KB | 450 lines appended to a domain module |
| `test-correspondence.test.ts` | every production source with runtime code has `__tests__/<name>.test.ts` beside it | a new source file with no spec; a constant, a function or an abstract class with a concrete method still counts |
| `esm-specifiers.test.ts` | relative imports in `universal` and `client` packages carry an explicit extension | an extensionless relative import |
| `core-barrels.test.ts` | each `@vp/core` barrel re-exports only its own folder; no `*.port.ts` anywhere | a barrel re-exporting a sibling folder |
| `no-domain-throw.test.ts` | no `throw` in `@vp/validation`, `@vp/domain-rules`, `@vp/core`, `apps/api/src/services/` or `apps/worker/src/stages/`, except a `throw assertNever` | `throw new Error` added to a rule |
| `validation-is-input-only.test.ts` | `@vp/validation` imports no `@vp/domain` or `@vp/core`, in source **and** in its manifest | a predicate taking a `Video` added to `@vp/validation` |
| `catch-confinement.test.ts` | `catch` appears only in `@vp/result`, `packages/server/adapters/`, the two composition roots and the two edges | a `try/catch` added to a service |
| `result-returning-ports.test.ts` | every I/O method on a `@vp/core` port or repository returns `Promise<Result<…>>` | a port method returning a bare `Promise<T>` |
| `error-code-drift.test.ts` | every `ErrorCode` has a `PROBLEM_STATUS` entry, a `RETRY_CLASS` entry and a line in SDD §6.2 | a code added to `ApiErrorCodes` only |
| `env-key-closure.test.ts` | every key the deployables read is declared in `@vp/env-schema`; every schema key is uncommented in `.env.example`; every key compose, the k8s base, CI steps running `pnpm` and `make` recipes hand to this code is declared | `process.env['STORAGE_RAW_BUCKET']`, and a `STORAGE_RAW_BUCKET:` line in a compose app env block |
| `env-confinement.test.ts` | `process.env` appears only in `@vp/config`, `@vp/env-schema`, `@vp/testing`, `apps/*/src/main.ts`, tool `*.config.ts` files and modules that end their own process | an env read added to a service |
| `no-defaulted-secrets.test.ts` | no `TOKEN\|SECRET\|PASSWORD\|ACCESS_KEY` key carries a `.default()`, and no production source holds a literal fallback for one | `ADMIN_TOKEN: z.string().default('change-me-32-bytes-random')`, and `process.env.ADMIN_TOKEN \|\| 'change-me-…'` |
| `adapter-instantiation.test.ts` | a concrete adapter is **constructed** only in a composition module or inside `@vp/adapters` | `new CaslAuthorizationAdapter()` inside a service, whose import alone would be legal |
| `total-dependencies.test.ts` | no service or stage recovers from a missing dependency (`?? new`, `\|\| new`, `?? default*`) | `deps.paginator ?? defaultPaginator` |
| `route-plugins.test.ts` | every route module exports a Fastify plugin, carries no options interface and appears in `routes/index.ts` | a route module exporting a bare `void` registrar |
| `drain-before-close.test.ts` | the shared shutdown flips readiness before it closes, both mains use it, and `/readyz` reads the drain flag before any dependency | a shutdown that closes the server before flipping readiness |
| `shutdown-closure.test.ts` | every resource a composition module constructs registers a disposer; `dispose()` releases in reverse construction order | an adapter registered with no disposer |
| `in-memory-off-boot-path.test.ts` | neither `main.ts` reaches an `adapters/in-memory/` module on its static boot path, and the root barrel does not re-export them | a boot path that reaches the doubles through a barrel |
| `apps/api/src/__tests__/contract-drift.test.ts` | every registered Fastify route has an `@vp/api-contracts` entry, and every contract entry is routed | a route registered with no contract entry |

The contract-drift assertion stays in `apps/api` because it has to boot the app: it builds a real Fastify
instance over the in-memory adapters and reads `printRoutes()`. Moving it would make the root workspace
depend on `@vp/api`, `@vp/adapters` and `fastify` to assert something only `apps/api` can answer.

**Five exception lists, all shrink-only.** `tests/architecture/oversized-sources.ts` and
`untested-sources.ts` record the files that already breached the ceiling and the 1:1 test mandate when those
rules became executable; `throwing-domain-sources.ts`, `legacy-catch-sites.ts` and `non-result-port-methods.ts`
record what ADR-24 has not converted yet. Each assertion fails on a *new* breach **and** on a listed entry
that no longer breaches, so the lists can only get shorter. None may be appended to.

Three further mechanisms sit outside the suite:

1. **It does not resolve.** pnpm links only declared dependencies, so a server import in `apps/web` — or an
   SDK import in either composition root — is `error TS2307: Cannot find module`, not a lint warning.
2. **`pnpm boundaries`** runs `scripts/check-boundaries.ts` plus the `CLAUDE.md` symlink check ahead of both
   `pnpm build` and `pnpm typecheck`, so a bad manifest fails before turbo starts.
3. **Dual-runtime parity.** `pnpm test` (vitest) and `pnpm test:bun` (bun) must both pass; Biome lint reports
   zero errors.
