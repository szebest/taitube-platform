# Architecture: Ports & Adapters (Hexagonal Architecture)

This document describes the architectural boundaries, ports, and adapters layer in the `video-pipeline` monorepo.

---

## 1. Architectural Principles

1. **Dependency Inversion:** High-level policy (domain services, routes, worker pipeline stages) must never import, instantiate, or depend directly on low-level details (concrete SDKs like `@aws-sdk/client-s3`, `ioredis`, `bullmq`, or Postgres/Drizzle drivers).
2. **Ports in `@vp/core`:** Every driver boundary is an abstract class in `@vp/core/ports`, and every repository an abstract class or interface in `@vp/core/repositories`. An abstract class is also a runtime value, which is what lets the composition container use it as a token. Every I/O method returns `Promise<Result<T, E>>` with the port's narrow failure (`result-returning-ports.test.ts`).
3. **Single Injection Seam:** Concrete adapters are constructed only inside `@vp/adapters` and by composition modules; `registerAdapters` picks the family, and the composition roots (`composeApp` in `apps/api/src/app.ts`, `composeWorker` in `apps/worker/src/runner.ts`) resolve one `Container` over it and inject its values down into domain services and worker stages.
4. **Interface Segregation:** Distinct responsibilities are separated into dedicated ports rather than god-objects:
   - Standard object operations live in `StorageClient`; multi-part lifecycle operations live in `MultipartStorage`.
   - Low-level database connection/transaction execution lives in `DatabaseClient`; domain entity data access lives in one repository per entity, bundled by `Repositories` (section 3).
5. **Modular Single-File Repository Design:** Each repository implementation has its own separate file in `repositories/`, adhering to single responsibility and clean file sizing (target <= 250 lines).
6. **First-Class In-Memory Test Doubles:** Every driver port (`DatabaseClient`, `Repositories`, `StorageClient`, `MultipartStorage`, `CacheClient`, `SubscriptionCachePort`, `JobQueue`, `FlowProducerPort`) has an in-memory adapter with realistic behaviour (CAS transitions, fencing token validation, multipart part assembly, pub/sub). The authorization adapter, the token verifier and the reaction and category caches are the same class in both families, since they run over those ports rather than an SDK. Unit specs run against the doubles, and the Postgres repositories against PGlite, with no Docker.

---

## 2. Directory Layout

Shared code sits under `packages/<tier>/`, where the directory **is** the runtime tier (Invariant 5).

```
taitube-platform/
├── apps/
│   ├── api/                        # Fastify API - composeApp in apps/api/src/app.ts, main.ts reads the env
│   ├── worker/                     # BullMQ worker - composeWorker in apps/worker/src/runner.ts
│   └── web/                        # Taitube web client (React 18 + CRA today; tickets 49-75 own the rewrite)
│
├── packages/universal/             # runs in a browser AND on a server
│   ├── api-contracts/              # @vp/api-contracts - every endpoint schema, one entry per route
│   ├── domain/                     # @vp/domain - entities, value objects, status vocabulary, ranking policy
│   ├── domain-rules/               # @vp/domain-rules - pure rules over input plus an entity
│   ├── errors/                     # @vp/errors - the ErrorCode vocabulary, failures, RFC 9457 mapping
│   ├── intl/                       # @vp/intl - every user-facing format, on Intl, context as an argument
│   ├── messages/                   # @vp/messages - typed dt()/t, the en catalogue, ERROR_COPY
│   ├── pagination/                 # @vp/pagination - the one keyset Paginator and cursor codec
│   ├── permissions/                # @vp/permissions - the pure CASL authorization engine
│   ├── result/                     # @vp/result - Result, tryCatch/fromPromise, ignore
│   ├── tsconfig/                   # @vp/tsconfig - base / server / universal / client / spec presets
│   └── validation/                 # @vp/validation - pure rules over submitted input
│
├── packages/client/                # browser only
│   ├── api-client/                 # @vp/api-client - typed client over @vp/api-contracts
│   └── intl-react/                 # @vp/intl-react - IntlProvider, useT, useFormat, <Format>
│
├── packages/server/                # Node/Bun only
│   ├── core/                       # @vp/core - abstract ports and repository contracts
│   │   ├── ports/                  # authorization, cache-client, category-cache, database-client,
│   │   │                           #   flow-producer, health-checkable, job-queue, multipart-storage,
│   │   │                           #   reaction-cache, storage-client, subscription-cache, token-verifier
│   │   └── repositories/           # one contract per domain entity + the aggregating Repositories
│   ├── adapters/                   # @vp/adapters - the only home of concrete driver SDKs
│   │   ├── auth/                   # JwksTokenVerifier, DevTokenVerifier
│   │   ├── authorization/          # CaslAuthorizationAdapter (@vp/permissions bridge)
│   │   ├── bullmq/                 # BullMqJobQueue, BullMqFlowProducer, the Bull Board queue adapters
│   │   ├── composition/            # registerAdapters and the in-memory / external families
│   │   ├── in-memory/              # the test doubles
│   │   ├── metered/                # MeteredStorageClient, MeteredMultipartStorage (storage metrics)
│   │   ├── postgres/               # repositories/, mappers/, scopes/ (CASL rules -> SQL, keyset)
│   │   ├── redis/                  # RedisCacheClient and the category, reaction, subscription, comment and playhead caches
│   │   └── s3/                     # S3StorageClient, S3MultipartStorage (@aws-sdk/client-s3)
│   ├── composition/                # @vp/composition - Container, tokens, shutdownOnce, exitOnSignals
│   ├── concurrency/                # @vp/concurrency - Singleflight
│   ├── config/                     # @vp/config - loadEnv(), the one reader of process.env
│   ├── db/                         # @vp/db - Drizzle schema, client, migrations, the seed functions
│   ├── env-schema/                 # @vp/env-schema - the zod schema, AppConfig and toAppConfig
│   ├── events/                     # @vp/events - publishVideoEvent, SSE framing, channels, cache keys
│   ├── ffmpeg/                     # @vp/ffmpeg - argument builders, progress parsers, probe rules
│   ├── job-contracts/              # @vp/job-contracts - BullMQ payloads, queue names, the ladder
│   ├── logger/                     # @vp/logger - createLogger (pino), json and pretty formats
│   ├── observability/              # @vp/observability - OpenTelemetry and Prometheus metrics
│   ├── storage/                    # @vp/storage - the S3 object key layout
│   ├── testing/                    # @vp/testing - shared vitest config, fixtures, assertion helpers
│   └── compose-autoscaler/ dev-token/ gen-video/ upload-client/   # developer CLIs
│
└── tests/
    ├── architecture/               # the executable form of section 5 - see section 6
    ├── e2e/                        # the acceptance runner (pnpm e2e)
    ├── in-process/                 # specs that compose both apps in one process
    └── load/                       # k6 scenarios
```

---

## 3. Core Ports & Repositories

Every I/O method below returns `Promise<Result<T, E>>`, where `E` is the port's own unavailability
(`DatabaseUnavailable`, `StorageUnavailable`, `CacheUnavailable`, `QueueUnavailable`); the signatures list
the method names only.

### `HealthCheckable`
```typescript
export interface HealthCheckable<E extends InfraFailure = InfraFailure> {
  checkHealth(): Promise<Result<void, E>>;
}
```
Every driver port implements it, and `/readyz` reads the verdicts instead of catching one. The S3 adapters
answer with a `HeadBucket` on the raw bucket.

### `DatabaseClient`
`query`, `execute`, `transaction`, `checkHealth`, `close`.

### Domain Repositories (`@vp/core/repositories`)
- **`VideoRepository`**: `findById`, `findWithDetails`, `create`, `listByOwner`, `listPublic`, `updateMetadata` (optimistic version check), `transition` (atomic CAS that appends to `video_events`), `scan`, `hardDelete`, `countByStatus`, `countInFlightByOwner`, `updateReactionCounters`.
- **`UploadRepository`**: `findById`, `findByVideoId`, `findWithVideo`, `create`, `updateStatus`.
- **`StepRepository`**: `claim`, `complete`, `fail`, `markDead` (all fenced by the worker's token), `heartbeat`, `findByVideoId`, `countRunningStale`.
- **`RenditionRepository`**: `create`, `findByVideoId`, `findByVideoIds`, `update`.
- **`EventRepository`**: `create`, `findByVideoId`, `findAfterId`, `findAfterIdForUser`, `getLatestEventId`.
- **`UserRepository`**: `findById`, `upsert`.
- **`DlqRepository`**: `create`, `findById`, `list`, `updateStatus`.
- **`OutboxRepository`**: `enqueue`, `claimBatch`, `markPublished`, `recordAttempt`, `prune`, `findById`.
- **`CategoryRepositoryPort`**, **`ChannelRepositoryPort`**, **`VideoReactionRepositoryPort`**, **`SubscriptionRepositoryPort`**: category taxonomy, channel identity, reactions with their counters, and subscriptions with the subscription feed.
- **`Repositories`**: the aggregate the composition roots hand around (`videos`, `uploads`, `steps`, `renditions`, `events`, `users`, `dlq`, `outbox`, `categories`, `channels`, `videoReactions`, `subscriptions`).

### `AuthorizationPort`
Abstracts user authorization and declarative rule evaluation. It answers the verdict; the refusal is a
rule's, through `authorize(actor, allowed, context)` in `@vp/domain-rules` (ADR-24):
- `getAbility()`: returns the active `@casl/ability` instance.
- `can(action, subject)` / `can(helper, params)`: evaluates if an action is permitted.
- `forUser(user)`: returns a new `AuthorizationPort` instance scoped to the target user.

### `TokenVerifier`
`verify(token)` answers `Result<Principal, AuthFailure>`. The JWKS adapter checks the signature, `iss`,
`aud`, the allowed algorithms and `exp`/`nbf`; the dev adapter is registered only when `auth.type` is `dev`.

### `StorageClient`
Object storage across local MinIO and Cloudflare R2: `uploadObject`, `downloadObject`, `headObject`,
`deleteObject`, `deleteObjects`, `listObjects`, `purgePrefix`, `getObject`, `createPresignedPutUrl`,
`createPresignedGetUrl`, `checkHealth`, `close`.

### `MultipartStorage`
`createMultipartUpload`, `createPresignedPartUrl`, `listMultipartParts`, `listMultipartUploads`,
`completeMultipartUpload`, `abortMultipartUpload`, `checkHealth`, `close`.

### `CacheClient`
Key-value caching and Pub/Sub: `get`, `set`, `del`, `ping`, `publish`, `subscribe`, `unsubscribe`,
`psubscribe`, `punsubscribe`, `checkHealth`, `close`. `CategoryCachePort`, `ReactionCachePort` and
`SubscriptionCachePort` are the typed caches built over it.

### `JobQueue` & `FlowProducerPort`
- `JobQueue`: `add`, `process`, `getName`, `getJobState`, `isPaused`, `pause`, `resume`, `getJobCounts`
  (over `QUEUE_JOB_STATES`), `getJobs`, `upsertJobScheduler`, `getJobSchedulers`, `close`, plus the
  `onFailed` / `onStalled` hooks.
- `FlowProducerPort`: `add(node)` enqueues a parent with its children (`FlowJobNode`), `checkHealth`, `close`.

---

## 4. Adapters (`@vp/adapters`)

| Port / Boundary | External Adapter | In-Memory Adapter |
|-----------------|--------------------|-------------------|
| `DatabaseClient` | `PostgresDatabaseClient` | `InMemoryDatabaseClient` |
| `Repositories` | `PostgresRepositories` | `InMemoryRepositories` |
| `StorageClient` | `S3StorageClient` | `InMemoryStorageClient` |
| `MultipartStorage` | `S3MultipartStorage` | `InMemoryMultipartStorage` |
| `CacheClient` | `RedisCacheClient` | `InMemoryCacheClient` |
| `SubscriptionCachePort` | `RedisSubscriptionCacheAdapter` | `InMemorySubscriptionCache` |
| `JobQueue` | `BullMqJobQueue` | `InMemoryJobQueue` |
| `FlowProducerPort` | `BullMqFlowProducer` | `InMemoryFlowProducer` |

Both families wrap storage in `MeteredStorageClient` / `MeteredMultipartStorage`, and share
`CaslAuthorizationAdapter`, the token verifier (`JwksTokenVerifier` or `DevTokenVerifier`, chosen by
`auth.type`), `RedisReactionCacheAdapter` and `RedisCategoryCacheAdapter`, which run over `CacheClient`.
`PermissiveAuthorizationAdapter` and `StrictAuthorizationAdapter` are the authorization doubles specs hand
in directly.

---

## 5. Architectural Invariants

### Invariant 1: Dedicated Repository Files
- Every repository implementation MUST live in its own dedicated file inside `repositories/` subfolders
  (`repository-files.test.ts`):
  - `packages/server/adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `packages/server/adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Monolithic multi-repository files are strictly forbidden.

### Invariant 2: File Length & Sizing Discipline
- Target size: `<= 250 lines` of code per file.
- Strict limit: `400 lines` or `10 KB` per file, specs and `tests/` included, asserted by
  `tests/architecture/file-ceiling.test.ts` with no exception list (section 6).
- See [docs/standards/file-discipline.md](docs/standards/file-discipline.md).

### Invariant 3: Autonomous In-Memory Test Doubles
- In-memory test doubles manage self-contained state and expose `.clear()` (`in-memory-doubles.test.ts`).
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
| `server` | `adapters`, `composition`, `compose-autoscaler`, `concurrency`, `config`, `core`, `db`, `dev-token`, `env-schema`, `events`, `ffmpeg`, `gen-video`, `job-contracts`, `logger`, `observability`, `storage`, `testing`, `upload-client` | `universal` + `server` |
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
| T1 | Foundation — no `@vp/*` dependency | `domain`, `errors`, `result`, `tsconfig`, `concurrency`, `job-contracts`, `logger`, `storage` |
| T2 | Contracts and policy, and the CLIs that log through `@vp/logger` | `composition`, `db`, `events`, `ffmpeg`, `observability`, `pagination`, `permissions`, `testing`, `validation`, `compose-autoscaler`, `dev-token`, `gen-video` |
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
   `DOM` and `types: []`, so a Node builtin or global is a type error. Relative imports are extensionless in
   every tier; `apps/web`'s webpack resolves them through the one override in `craco.config.js`. Specs run under
   `@vp/tsconfig/spec.json` via a package's own `tsconfig.spec.json`, so importing `vitest` cannot leak
   `@types/node` back into the package's program.

`tests/architecture/package-boundaries.test.ts` asserts the same rules in the unit suite — see section 6.
Full reference, including the per-package map and the recipes: [packages/AGENTS.md](packages/AGENTS.md).

- `apps/web` must NEVER import `@vp/core`, `@vp/adapters`, `@vp/db` or any `server` package.
- The frontend talks to the backend only through `@vp/api-contracts` and `@vp/api-client`.
- For all frontend architectural patterns, see [apps/web/AGENTS.md](apps/web/AGENTS.md).

### Invariant 6: Deterministic Test Suite Parity
- Every production source with runtime code has a spec of the same name beside it in `__tests__/`,
  asserted by `tests/architecture/test-correspondence.test.ts` with no exception list (section 6). A module that erases to nothing - types, interfaces, an abstract class of abstract members -
  is not a target: its spec could only assert that TypeScript compiles.
- No heuristic skips: test suites never swallow connection errors or skip assertions conditionally.
- Strict 1:1 parity between local developer environments and remote CI pipelines.
- Unit tests execute against in-memory doubles; database durability tests execute against PostgreSQL.
- See [docs/standards/testing.md](docs/standards/testing.md).

---

### Invariant 7: Results at the Domain Seam

A failure is part of every signature below the edge. Domain code returns `Result<T, E>` from `@vp/result`
instead of throwing it (SDD ADR-24), and only two places unwrap one: `sendResult` in `apps/api/src/routes/`
and `instrument` in `apps/worker/src/composition/stages.module.ts`, which converts through `RETRY_CLASS` because BullMQ's retry contract *is*
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
- **`ADAPTER_FAMILY` is the one adapter switch.** `toAppConfig()` turns it into `config.kind`
  (`AdapterKind`), and `registerAdapters(c, config)` in `@vp/adapters` imports only that family.
- **Dependencies are total.** A service or stage never constructs, defaults or infers a collaborator it was
  not handed; forgetting one in a composition module is a compile error.
- **A concrete adapter is constructed only in a composition module** or inside `@vp/adapters` itself.
- **No secret-shaped key has a default**, and a production boot refuses a missing or placeholder one.

### Invariant 9: A Process Drains Before It Closes

- `composeApp()` / `composeWorker()` construct; `container.start()` runs I/O. A test that builds the app
  opens no subscription and leaves no timer.
- On `SIGTERM`/`SIGINT` both processes run `shutdownOnce` from `@vp/composition`: readiness flips first,
  the listener keeps accepting for the drain delay, then the server closes and the container disposes in
  reverse construction order. A close that outlives the grace window is abandoned and the pending disposer
  is named in the log.
- Every resource a composition module constructs registers a disposer.
- `terminationGracePeriodSeconds`, the `preStop` hook, compose's `stop_grace_period` and each process's
  grace window are derived from one another (SDD ADR-25).

### Invariant 10: User-Facing Formatting Happens in `@vp/intl`

Every number, date, duration, list and count a person reads is formatted by `@vp/intl` (SDD ADR-26), and
every word around it comes from `@vp/messages`.

- **No ad-hoc formatting.** No `toLocale*` call and no hand-built `Intl` object outside `@vp/intl`, and no
  `toFixed` as display text in browser-reachable code. `@vp/intl-react`'s `browser-environment.ts` reads the
  runtime's time zone and is the one named exception.
- **The context is an argument.** Neither `@vp/intl` nor `@vp/messages` reads `navigator`, the clock,
  `process` or a `toLocale*` method, so a server render and its hydration produce the same text.
- **The server returns codes.** No `apps/api`, `apps/worker` or `packages/server` source or manifest names
  `@vp/messages`; the client renders a failure through `ERROR_COPY`, which covers every `ErrorCode`.

Authority: [docs/standards/formatting-and-i18n.md](docs/standards/formatting-and-i18n.md).

## 6. Verification & Enforcement

The invariants in section 5 are held by the assertions in `tests/architecture/`, run by
`pnpm test:architecture` (no build; about 3 s locally, held to 6 s in CI by `.github/actions/budget`) and
inside `pnpm test`. CI runs it once, in `lint-typecheck` ahead of lint and typecheck; `pnpm test:unit` leaves
it out. What the suite does not hold is listed under the table: a rule a human has to remember to check is a
rule that has already drifted, so a gap is named rather than left looking enforced.

| Assertion | Holds | Fixture that proves it fires |
|---|---|---|
| `package-boundaries.test.ts` | `checkBoundaries()` from `scripts/check-boundaries.ts`, over every manifest under `packages/<tier>/` and `apps/`: a `packages/` package takes its tier from its directory and must not declare `vp.tier`, an app must; tiers only depend where allowed (`universal` never on `server`); dependencies point strictly down, devDependencies included, `@vp/tsconfig` and `@vp/testing` exempt | planted manifests: a `client` package depending (and dev-depending) on a `server` one; a T2 package depending on a T4 one |
| `sdk-confinement.test.ts` | regex over import specifiers: `@aws-sdk/*`, `ioredis`, `bullmq`, `postgres` and `drizzle-orm` are named only under `packages/server/adapters/` and `packages/server/db/` across `.ts`/`.tsx` in `apps`, `packages`, `scripts`, `tests` and `tools`, and declared in no other manifest (root included); `@vp/adapters` is imported, **within `apps/` only**, from a `composition/` module, `app.ts` or `runner.ts` | `import { CaslAuthorizationAdapter } from '@vp/adapters'` at a service path |
| `lockfile-closure.test.ts` | `apps/web`'s runtime workspace closure, and its dev closure with build tooling aside, holds no `packages/server/` package - read line by line from the `importers` of `pnpm-lock.yaml`, so a transitive edge is caught too | none - reads the repo |
| `workspace-closure.test.ts` | the line-based lockfile reader behind `lockfile-closure`, `frontend-vocabulary` and `load-smoke-triggers` follows `dependencies`, `optionalDependencies` and `devDependencies` and exempts build tooling only on a dev edge - asserted over a planted lockfile only | a planted lockfile where `apps/web` has a runtime `@vp/testing` edge that drags in `@vp/job-contracts` |
| `repo-files.test.ts` | the index reader every text ratchet scans through: `trackedFiles` lists, for a `:(glob)` pathspec, exactly the tracked files `matchesGlob` matches, and `:(exclude,glob)` drops its matches | none - compares against `matchesGlob` over `git ls-files` |
| `frontend-vocabulary.test.ts` | substring match over the `.ts`/`.tsx` under `src/` of `apps/web` and its lockfile runtime closure (outside `__tests__`/`__mocks__`): no server secret, key or queue name (`ADMIN_TOKEN`, `DATABASE_URL`, `transcode-1080p`, `minioadmin`, ...); every `packages/universal/` and `packages/client/` manifest that ships `src/` sets `sideEffects: false` | none - reads the repo |
| `local-first.test.ts` | regex for `http(s)://` literals: no production source (`apps`, `packages`, `scripts`), no `apps/web/public/*.html` and no `tools/hls-test-page/*.html` names an off-machine host; every uncommented `.env.example` line is local | `'https://taitube-backend.onrender.com'` in a planted source |
| `file-ceiling.test.ts` | no tracked `.ts`/`.tsx`/`.mts` file, specs and `tests/` included, over 400 lines or 10 KB; no exception list | a 401-line spec body; a one-line file over 10 KB |
| `no-process-comments.test.ts` | no comment and no `it`/`test`/`describe`/`suite`/`bench` title names a ticket, an AC, a workstream, a PR number or a numbered step, over `.ts`/`.tsx`/`.js`/`.mjs`/`.mts` in `apps`, `packages`, `scripts` and `tests` (regex prefilter, then the TypeScript parser); `ADR-NN` and `SDD §` stay allowed | `const a = 1; // AC 3`, `describe('Outbox relay (Ticket 30)', ...)` |
| `redis-keys-owner.test.ts` | every Redis key and channel is built in `@vp/events` (`keys.ts`, `channels.ts`): no template literal starting `taitube:`, `video:` or `user:` and no `taitube:` string elsewhere in production source (AST) | `` `taitube:user:${userId}:reactions` `` in a planted source |
| `test-correspondence.test.ts` | every production source other than `index.ts` and `*.config.ts` whose transpiled output holds runtime code has `__tests__/<name>.test.ts(x)` beside it, in every tier and `apps/web` included, with no exception list; comments are stripped first, so a documented abstract port asks for none | `export const LIMIT = 3;` and an abstract class with a concrete method still ask a spec; an interface or an all-abstract class does not |
| `esm-specifiers.test.ts` | no relative import, re-export, dynamic `import()`, `require` or `vi.mock` in any tracked `.ts`/`.tsx`/`.mts` under `apps`, `packages`, `scripts` and `tests`, specs included, carries an extension (`.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx`) (AST) | `import { ok } from './result.js';`, `vi.mock('./adapter.js', ...)` |
| `core-barrels.test.ts` | regex: the `index.ts` barrels of `@vp/core` `ports/` and `repositories/`, `@vp/domain` and `@vp/pagination` `export *` only from `./`; no `*.port.ts` under `apps/` or `packages/` | none - reads the repo |
| `no-domain-throw.test.ts` | regex over production source in `@vp/validation`, `@vp/domain-rules`, `@vp/core`, `apps/api/src/services/` and `apps/worker/src/stages/`: no `throw` except `throw assertNever`, no `*OrThrow(` helper, no capitalised `X.parse(` (a zod schema or `JSON.parse`) | `NotifyJob.parse({ videoId })`, `unwrapOrThrow(await repo.f())` |
| `validation-is-input-only.test.ts` | regex over import specifiers: `@vp/validation` imports no `@vp/domain` or `@vp/core`, in source **and** in its manifest's dependency groups; `@vp/domain-rules` still declares `@vp/domain` | none - reads the repo |
| `catch-confinement.test.ts` | a `try/catch` or a `.catch(` (regex over text) appears in production source only in `@vp/result`, `packages/server/adapters/` and the `ENTRYPOINTS` files, and a two-argument `.then(onOk, onErr)` (AST) only in an `ENTRYPOINTS` file; no exception list | `load().then(undefined, () => 0)`, `storage.deleteObject(bucket, key).catch(() => {})` |
| `result-returning-ports.test.ts` | regex over method signatures: every `Promise`-returning abstract or interface method in `@vp/core` `ports/` and `repositories/`, and every `export async function` in `@vp/events`, returns `Promise<Result<...>>` | none - reads the repo |
| `no-discarded-result.test.ts` | no expression statement in production source leaves a `Result` or a promise of one unread, through `await`, `void`, parentheses or a trailing `.catch`/`.finally` (type-aware, on the shared `ts.Program`); a deliberate drop is `ignore(result, 'reason')` | a fixture program with `await repo.remove();`, `void repo.remove();`, `repo.remove().catch(() => {});` and `check();` |
| `error-vocabulary.test.ts` | AST: no string literal assigned to a `code` / `errorCode` / `error_code` property in `apps/api`, `apps/worker`, `packages/server`, `packages/universal` or `scripts` is outside `ErrorCodes` (metric labels aside), and every `*Options`/`*Input` interface in `@vp/core` `repositories/` types its `errorCode` as `ErrorCode` | `{ errorCode: 'ORPHANED_VIDEO' }`; `interface FailStepOptions { errorCode: string }` |
| `intl-purity.test.ts` | AST over production source in `@vp/intl` and `@vp/messages`: no `navigator`, `window`, `document`, `localStorage` or `process` identifier, no `Date.now()`, no zero-argument `new Date()`, no `toLocale*` call | `const locale = navigator.language;`, `const today = new Date();` |
| `no-adhoc-formatting.test.ts` | AST over production source outside `@vp/intl` (and `@vp/intl-react`'s `browser-environment.ts`, which reads the runtime zone): no `toLocale*` call, no `new Intl.X(...)` or `Intl.X(...)` construction; in `apps/web`, `packages/client` and `packages/universal`, no `toFixed` | `new Date(x).toLocaleDateString()`, `` `${size.toFixed(1)} MB` `` |
| `messages-are-client-only.test.ts` | regex over import specifiers and manifests: no production source under `apps/api`, `apps/worker` or `packages/server` imports `@vp/messages`, and no manifest there declares it | `import { en } from '@vp/messages';` |
| `error-copy-coverage.test.ts` | regex over text: every code in `api-error-codes.ts` and `pipeline-error-codes.ts` has an `[ErrorCodes.X]` entry in `ERROR_COPY`, and every entry names a message `src/en/errors.ts` declares | a planted map holding only `INTERNAL` |
| `no-in-probes.test.ts` | no `'literal' in value` narrowing in production source, the browser tier included (AST) | `if ('rendition' in child)` |
| `no-truthy-result.test.ts` | regex over production source in `apps/` and `packages/server/`: a `const x = await ....<repo>.<method>(` binding, for each `Repositories` property whose contract returns only `Promise<Result<...>>`, is not read in its block as a truthy value, a nullish or `\|\|` default, an `Object` walk, a spread, a serialisation, an interpolation, an index or a comparison | `const v = await repo.videos.findById(id);` then `if (!v) return;` |
| `class-name-inference.test.ts` | regex over production source outside `@vp/errors` and `packages/server/adapters/s3/` (the S3 SDK `name` check is the documented exception): no `constructor.name` or `.name === '...Error'` comparison, no `.isRetryable` probe, no `.code` compared to a bare `ErrorCode` literal | `err.name === 'UnrecoverableError'`, `err.code === 'VERSION_CONFLICT'` |
| `error-code-drift.test.ts` | regex over text: every code in `api-error-codes.ts` and `pipeline-error-codes.ts` has an `[ErrorCodes.X]` entry in `PROBLEM_STATUS` (`problem.ts`) and `RETRY_CLASS` (`retry-class.ts`), and the SDD §6.2 enumeration lists exactly those codes, both ways | none - reads the repo |
| `env-key-closure.test.ts` | every `process.env` key read in the production source of the `@vp/api`/`@vp/worker` runtime package closure is declared in `@vp/env-schema`; every schema key is uncommented in `.env.example`; every key `docker-compose.yml`, the k8s base and overlays (patches and `ExternalSecret` entries included), a CI step running `pnpm` and a `make` recipe prefix hand the apps is declared (indent-based text reads, not a YAML parse) | `path: /data/HOUSEKEEPING_INTERVAL_MS` in a planted overlay patch; `process.env['STORAGE_RAW_BUCKET']` in a planted source |
| `env-confinement.test.ts` | `process.env` appears only in the `ENTRYPOINTS` and `ENV_HOMES` `entrypoints.ts` lists, over `.ts`, `.tsx`, `.mts`, `.js` and `.mjs` in `apps`, `packages`, `scripts` and `tests` (specs, `__tests__` and `__mocks__` aside), and every listed entry exists | `process.env['S3_BUCKET_RAW']` at a service path; `process.env.REDIS_URL` in a `.mjs` path |
| `no-defaulted-secrets.test.ts` | regex: no `TOKEN\|SECRET\|PASSWORD\|ACCESS_KEY` key in `app-env.ts` carries a `.default()`, no production source holds a `process.env.X \|\| '...'` literal fallback for one, and no production source line carries URL userinfo | `REDIS_URL: z.string().default('redis://:vp@localhost:6379/0')` |
| `env-keys-consumed.test.ts` | every `AppEnv` key is read as `env.KEY` in `app-config.ts` (regex); every `AppConfig` leaf is read by production source in `apps/api/src`, `apps/worker/src` or `packages/server` outside `env-schema` (type-aware, on the shared `ts.Program`); no `platform-env.json` key is also an `AppEnv` key | a fixture program whose consumer never reads `http.host` or `pool.bogusTtlSeconds` |
| `no-tuning-literals.test.ts` | AST over production source in `apps/api/src/services`, `apps/worker/src`, `packages/server/adapters` and `packages/server/ffmpeg/src`: no numeric `??` fallback other than `0`/`1`, no numeric destructuring or parameter default, no numeric module-scope constant, no minute/hour/day spelt as literal arithmetic | `const { concurrency = 4 } = deps;`, `export const QUEUE_POLL_INTERVAL_MS = 5_000;` |
| `no-test-hooks.test.ts` | regex for named fault-injection flags (`forceFailure`, `simulateFailure`, `x-test-`, `killAtPercent`, ...) in production source, `@vp/job-contracts` included | `request.headers['x-test-crash-after-commit']` |
| `log-calls.test.ts` | every `log`/`logger` level call carries a fixed lowercase literal message and puts its values in fields: no template, concatenation, printf args or non-literal message, in production source (scripts included) and `tests/e2e/*.ts` (AST) | ``log.warn(`probe of ${videoId} failed`)`` in a planted source |
| `promql-labels-emitted.test.ts` | every dashboard JSON, alert rule and `scaled-objects.yaml` KEDA query parses with `@prometheus-io/lezer-promql`, names a metric the registry or a known exporter provides, and selects only label values recorded by code (read type-aware on the shared `ts.Program`) or, for `deployment`, the base's Deployment names | `jobs_processed_total{result="stalled"}` against a fixture that records only `completed`/`failed`; `neon_compute_hours_used` |
| `minio-images-pinned.test.ts` | every MinIO image in `infra/compose/docker-compose*.yml`, and `image`/`mcImage` in `infra/k8s/helm-values/minio.yaml`, is pinned by `@sha256:` digest (YAML parse) | `image: "cgr.dev/chainguard/minio:latest"` in a planted compose file |
| `production-secrets.test.ts` | `kustomize build` of the base fails `AppEnvSchema.safeParse` on every `SECRET_KEYS` member and `AUTH_JWKS_URL` until they are overridden; the cloud overlay renders no Secret value, exactly one `ExternalSecret` entry per `SECRET_KEYS` member, no key owned by both it and the ConfigMap, and no local credential | a planted `Secret` with `REDIS_URL: 'redis://:vp@redis:6379/0'` |
| `zero-matches.test.ts` | regex over text: each of 35 counted patterns stays at its expected match count over its own scope (e.g. one `worker-${process.pid}` default, no `as unknown as`, no `console.`) | each row's own snippet, e.g. ``workerId: `worker-${process.pid}` `` |
| `spec-discipline.test.ts` | AST over every spec, `__tests__` helper, `tests/architecture`, `tests/in-process` and e2e spec: no runtime import from `vitest`, no timer wait (`setTimeout`/`setImmediate`, bare or on `globalThis`, inside a `new Promise` or as its executor, a static or dynamic `import()` of `timers/promises`), no `sleep`/`settle`/`delay` helper, no elapsed wall-clock assertion, no `typeof import(` or `importOriginal<`, no repeated full test title, no `console` call, no `.skip`/`.only`/`.todo`/`skipIf`/`runIf` | one fixture per rule, and the look-alikes that must pass |
| `ci-shape.test.ts` | YAML parse of `.github/workflows/ci.yml`: each job's `timeout-minutes` is its budget, no `needs` chain sums past 6 minutes, `unit` and the architecture suite sit behind `.github/actions/budget`, the architecture suite runs in one job, the docs-only path filter gates every job, services and `db:migrate` appear only in `integration` and `e2e-smoke`, and only `unit-bun` sets up Bun | a fixture workflow that breaks every rule |
| `load-smoke-triggers.test.ts` | YAML parse of `.github/workflows/load-smoke.yml`: its `pull_request.paths` cover `apps/api`, `apps/worker` and every package in their lockfile runtime closure, and end with `!**/*.md` | none - reads the repo |
| `doc-links.test.ts` | every relative link and `#anchor` in every tracked `.md` outside `.agents/` (symlinked `CLAUDE.md` skipped) resolves, anchors slugged by `github-slugger` (markdown parsed with `markdown-it`) | `SDD.md#adr-24-result-typed-errors` for a heading with an em dash |
| `doc-commands.test.ts` | every `pnpm <script>`, `make <target>` and backticked repo path in `README.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `docs/SDD.md`, `docs/standards/`, `docs/runbooks/` and every `AGENTS.md` exists (git-ignored paths aside); the README tree draws exactly the workspace packages; `.PHONY` lists exactly the Makefile rules | `make up-all` with no such rule |
| `architecture-table.test.ts` | the bare-named first-cell code spans of this section's tables are exactly the `*.test.ts` files in `tests/architecture/`; rows naming a path are not checked | a planted document whose section-5 row and second-cell code span are not read as rows |
| `tests/in-process/gen-index.test.ts` | spawns `python3 docs/tickets/gen-index.py`: `--check` passes (index current, one status vocabulary, every spec anchor real), `--anchors` agrees with `github-slugger` on the SDD, the PRD and edge-case headings, and changing a status moves the computed frontier | a ticket with `**Status:** ready-for-agent` in a planted tickets directory |
| `repository-files.test.ts` | every exported `*Repository` class under `packages/server/adapters/` lives under a `repositories/` folder, in a file named after it in kebab case, with no other class beside it (AST) | a planted repository outside `repositories/`, one under another file name, and two classes in one file |
| `in-memory-doubles.test.ts` | every class under `packages/server/adapters/in-memory/` that keeps a `Map`, a `Set` or an array field has a `clear()` method (AST) | a planted double with a `Map` field and no `clear()`, beside one that has it and a stateless one |
| `adapter-instantiation.test.ts` | a class exported from `packages/server/adapters` is `new`-ed (regex) only in a `composition/` module, `@vp/adapters` or `@vp/testing`; a service or a stage `new`s values only (`Date`, `Map`, `Set`, `URL`, `Promise`, `AbortController`, an `*Error`, `SseConnection`) (AST) | `new Singleflight()` in a planted service source; `new CaslAuthorizationAdapter()` at a service path |
| `total-dependencies.test.ts` | no source in `apps/api/src/services/`, `apps/worker/src/stages/`, `packages/server/adapters/`, `apps/api/src/app.ts` or `apps/worker/src/runner.ts` recovers from a missing dependency: `?? new`, `\|\| new`, `?? default*`, `?? inProcessAppConfig(` (regex), or a parameter or destructuring default that is constructed, called or `default*` (AST) | `function f(cursor: string, paginator = defaultPaginator) {}`, `deps.authorization ?? new CaslAuthorizationAdapter()` |
| `no-module-state.test.ts` | in production source outside `ENTRYPOINTS`: no module-scope `let`/`var`, no module-scope `new` other than an immutable value or a `Readonly` collection, and no top-level call statement, awaited or not (AST) | `export const paginator = new Paginator();`, `collectDefaultMetrics({ register });` |
| `tests/in-process/start-order.test.ts` | both composition roots, built in process over `inProcessAppConfig()`, start every consumer after the metrics server, and the worker's after its heartbeat, read from `container.started()` | a start order `['Consumer', 'MetricsServer', 'Heartbeat', 'OutboxRelay']` |
| `route-plugins.test.ts` | regex: every file under `apps/api/src/routes/` that registers a route exports `async function xRoutes(app: FastifyInstance): Promise<void>`, declares no `*Options` interface, and is named in `routes/index.ts` | `export function registerVideosRoutes(app, options): void`; `export interface VideosRouteOptions` |
| `routes-unwrap-at-send-result.test.ts` | line regex over `apps/api/src/routes/`: no `throw` (except `throw assertNever`) and no `catch` clause, and no import from `@vp/core/ports`, `@vp/core/repositories` or `@vp/adapters` (`health.ts` reports on the adapters themselves) | `throw new PermanentError(e.code, e.message);`, `} catch (err) {` |
| `drain-before-close.test.ts` | text order: `shutdownOnce` in `@vp/composition` calls `plan.drain()` before it closes, `apps/api/src/serve.ts` and `apps/worker/src/process.ts` both call it with a `drain`, and the readiness service reads `this.draining` before `checkHealth` | `await plan.close();\nplan.drain();` |
| `shutdown-closure.test.ts` | regex: every `.provide(...)` in a `composition/` module that `new`s a class defining `close()` or `stop()` (from `packages/server/adapters/`, `apps/api/src/services/` or `apps/worker/src/`) also passes a `dispose` or `closeOnDispose` | `.provide(Redis, () => new RedisCacheClient({ type: 'url', url }))` |
| `in-memory-off-boot-path.test.ts` | neither `main.ts` reaches an `adapters/in-memory/` module through its static, non-type imports (regex graph walk, `@vp/*` resolved through manifest `exports`), and the `@vp/adapters` root barrel does not re-export them | a planted boot path that reaches the doubles through a barrel |
| `apps/api/src/__tests__/contract-drift.test.ts` | boots the real app over the in-memory adapters: every route an `onRoute` hook collects (vendor prefixes aside) has an `@vp/api-contracts` entry, every contract entry is routed, and each OpenAPI operation carries the contract's summary, description and tag | none - reads the repo |

The rows with a path run elsewhere: `tests/in-process/start-order.test.ts` and
`tests/in-process/gen-index.test.ts` compose apps or spawn Python, so they are in-process specs and run in
`pnpm test:unit`, not `pnpm test:architecture`, and the contract-drift assertion runs with `apps/api`'s own specs.

The suite does not assert everything section 5 says. Invariant 4's `app.services` rule, Invariant 6's
local and CI parity, Invariant 8's single adapter switch and Invariant 9's grace-period derivation are held by
unit specs (`apps/worker/src/__tests__/registry.test.ts`, `k8s-local-overlay.test.ts`) or by review, not here.

The contract-drift assertion stays in `apps/api` because it has to boot the app: it builds a real Fastify
instance over the in-memory adapters and reads `printRoutes()`. Moving it would make the root workspace
depend on `@vp/api`, `@vp/adapters` and `fastify` to assert something only `apps/api` can answer.

**No exception lists.** Every assertion here is flat: `test-correspondence` fails on any source with runtime
code and no name-matching spec, in every tier, and `zero-matches` fails if an exception list or `shrinkOnly`
comes back.

Four further mechanisms sit outside the suite:

1. **It does not resolve.** pnpm links only declared dependencies, so a server import in `apps/web` — or an
   SDK import in either composition root — is `error TS2307: Cannot find module`, not a lint warning.
2. **`pnpm boundaries`** runs `scripts/check-boundaries.ts` plus the `CLAUDE.md` symlink check ahead of both
   `pnpm build` and `pnpm typecheck`, so a bad manifest fails before turbo starts.
3. **Dual-runtime parity.** `pnpm test` (vitest) and `pnpm test:bun` (bun) must both pass; Biome lint runs
   with `--error-on-warnings`, and every rule it enables is at `error`.
4. **`pnpm knip`**, twice in `lint-typecheck`: the default run (unused files, exports, types, dependencies,
   unlisted imports) and `--production` (exports only a spec imports), both at zero, with
   `includeEntryExports` on so a barrel export nobody imports is reported too.
