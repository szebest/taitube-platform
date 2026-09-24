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
│   ├── pagination/                 # @vp/pagination - the one keyset Paginator and cursor codec
│   ├── permissions/                # @vp/permissions - the pure CASL authorization engine
│   ├── result/                     # @vp/result - Result, tryCatch/fromPromise, ignore
│   ├── tsconfig/                   # @vp/tsconfig - base / server / universal / client / spec presets
│   └── validation/                 # @vp/validation - pure rules over submitted input
│
├── packages/client/                # browser only
│   └── api-client/                 # @vp/api-client - typed client over @vp/api-contracts
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
│   │   ├── redis/                  # RedisCacheClient and the category, reaction and subscription caches
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
- Every repository implementation MUST live in its own dedicated file inside `repositories/` subfolders:
  - `packages/server/adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `packages/server/adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Monolithic multi-repository files are strictly forbidden.

### Invariant 2: File Length & Sizing Discipline
- Target size: `<= 250 lines` of code per file.
- Strict limit: `400 lines` or `10 KB` per file, specs and `tests/` included, asserted by
  `tests/architecture/file-ceiling.test.ts` with no exception list (section 6).
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

## 6. Verification & Enforcement

Every invariant in section 5 is an assertion in `tests/architecture/`, run by `pnpm test:architecture`
(no build; about 3 s locally, held to 6 s in CI by `.github/actions/budget`) and inside `pnpm test`. CI runs
it once, in `lint-typecheck` ahead of lint and typecheck; `pnpm test:unit` leaves it out. **An invariant that cannot be asserted is deleted from this document rather than
left as decoration** — a rule a human has to remember to check is a rule that has already drifted.

| Assertion | Holds | Fixture that proves it fires |
|---|---|---|
| `package-boundaries.test.ts` | a package under `packages/<tier>/` takes its tier from that directory and must not declare `vp.tier`; everything else must; `universal` never depends on `server`; dependencies point strictly down, devDependencies included | a manifest that declares a tier its directory already fixes |
| `sdk-confinement.test.ts` | `@aws-sdk/*`, `ioredis`, `bullmq`, `postgres` and `drizzle-orm` are imported only under `packages/server/adapters/` and `packages/server/db/`, and **declared** in no other manifest; `@vp/adapters` is imported only from a composition module | `import { Queue } from 'bullmq'` in `apps/api/src/app.ts`; `import { CaslAuthorizationAdapter } from '@vp/adapters'` in a service |
| `lockfile-closure.test.ts` | `apps/web`'s resolved runtime closure holds no `server`-tier package — read from the lockfile, so a transitive edge is caught too | a `server` package linked into a `universal` package two hops from `apps/web` |
| `workspace-closure.test.ts` | the lockfile reader behind `lockfile-closure` and `frontend-vocabulary` follows every dependency group and exempts build tooling reached by a dev edge only | a planted `@vp/testing` runtime edge in `apps/web` |
| `frontend-vocabulary.test.ts` | nothing the browser resolves names a server secret, key or queue (`ADMIN_TOKEN`, `DATABASE_URL`, `transcode-1080p`, `minioadmin`, ...), and every browser-tier package lets webpack drop what it does not use | `minioadmin` inside a universal package |
| `local-first.test.ts` | no production source names an off-machine host; every uncommented `.env.example` default is local | a hardcoded `https://…onrender.com` |
| `file-ceiling.test.ts` | no tracked `.ts`/`.tsx`/`.mts` file, specs and `tests/` included, over 400 lines or 10 KB; no exception list | a spec of 401 lines |
| `no-process-comments.test.ts` | no comment and no `it`/`describe` title names a ticket, an AC, a workstream, a PR number or a numbered step, in production source, specs and `tests/` (AST); `ADR-NN` and `SDD §` stay allowed | `// AC 3` above a test, `describe('Outbox relay (Ticket 30)')` |
| `redis-keys-owner.test.ts` | every Redis key and channel is built in `@vp/events` (`keys.ts`, `channels.ts`): no template literal starting `taitube:`, `video:` or `user:` and no `taitube:` string elsewhere in production source (AST) | `` `taitube:user:${userId}:reactions` `` in an adapter |
| `test-correspondence.test.ts` | every production source with runtime code has `__tests__/<name>.test.ts` beside it | a new source file with no spec; a constant, a function or an abstract class with a concrete method still counts |
| `esm-specifiers.test.ts` | no relative import in any tracked TypeScript source, specs included, carries an extension (`.js`, `.mjs`, `.ts`, `.tsx`); `apps/web` resolves extensionless workspace output through `craco.config.js` | `import { ok } from './result.js'` |
| `core-barrels.test.ts` | each `@vp/core` barrel re-exports only its own folder; no `*.port.ts` anywhere | a barrel re-exporting a sibling folder |
| `no-domain-throw.test.ts` | no `throw`, `*OrThrow(` helper or throwing `Schema.parse(` / `JSON.parse(` in `@vp/validation`, `@vp/domain-rules`, `@vp/core`, `apps/api/src/services/` or `apps/worker/src/stages/`, except a `throw assertNever` | `NotifyJob.parse({...})` in a stage |
| `validation-is-input-only.test.ts` | `@vp/validation` imports no `@vp/domain` or `@vp/core`, in source **and** in its manifest | a predicate taking a `Video` added to `@vp/validation` |
| `catch-confinement.test.ts` | a `try/catch` or a `.catch(` appears only in `@vp/result`, `packages/server/adapters/` and an entrypoint's exit-code handler, and a two-argument `.then(onOk, onErr)` only in an entrypoint (AST); no exception list | `load().then(undefined, () => 0)` in a service |
| `result-returning-ports.test.ts` | every I/O method on a `@vp/core` port or repository, and every exported async function of `@vp/events`, returns `Promise<Result<…>>` | a port method returning a bare `Promise<T>` |
| `no-discarded-result.test.ts` | no statement in production source leaves a `Result` or a promise of one unread, through `await`, `void`, parentheses or a trailing `.catch`/`.finally` (type-aware, on the shared `ts.Program`); a deliberate drop is `ignore(result, 'reason')` | `await cache.set(key, value)` with its failure dropped |
| `error-vocabulary.test.ts` | no string literal assigned to a `code` / `errorCode` in server source is outside `ErrorCode`, and every repository write types its `errorCode` as `ErrorCode` | `errorCode: 'ORPHANED'` before it was a code |
| `no-in-probes.test.ts` | no `'literal' in value` narrowing in production source, the browser tier included (AST) | `if ('rendition' in child)` |
| `no-truthy-result.test.ts` | no `Result` from a converted port or repository is read as a truthy value, a nullish default, an `Object` walk, a spread, a serialisation or an interpolation | `if (!channel)` on a converted `findById` |
| `class-name-inference.test.ts` | an error's identity is `instanceof` and its retry class is `classifyError`: no `.name === 'SomeError'`, no `.isRetryable` probe, no `.code` compared to a bare literal (the S3 adapter's SDK `name` check is the documented exception) | `err.name === 'UnrecoverableError'` |
| `error-code-drift.test.ts` | every `ErrorCode` has a `PROBLEM_STATUS` entry, a `RETRY_CLASS` entry and a line in SDD §6.2 | a code added to `ApiErrorCodes` only |
| `env-key-closure.test.ts` | every key the deployables read is declared in `@vp/env-schema`; every schema key is uncommented in `.env.example`; every key compose, the k8s base and overlays (patches and `ExternalSecret` entries included), CI and `make` hand the apps is declared | an overlay patch adding `/data/HOUSEKEEPING_INTERVAL_MS` |
| `env-confinement.test.ts` | `process.env` appears only in the `ENTRYPOINTS` and `ENV_HOMES` `entrypoints.ts` lists, over `.ts`, `.tsx`, `.mts`, `.js` and `.mjs` in `apps`, `packages`, `scripts` and `tests` | a `process.env` read in a service, or in a `.mjs` helper |
| `no-defaulted-secrets.test.ts` | no `TOKEN\|SECRET\|PASSWORD\|ACCESS_KEY` key carries a `.default()`, no production source holds a literal fallback for one, and no schema default or production literal carries URL userinfo | `REDIS_URL: z.string().default('redis://:vp@localhost:6379/0')` |
| `env-keys-consumed.test.ts` | every `AppEnv` key is read by `toAppConfig`, every `AppConfig` leaf is read by production source outside `env-schema` (type-aware), and no `platform-env.json` key is also an `AppEnv` key | a config leaf nothing reads |
| `no-tuning-literals.test.ts` | no numeric `??` fallback other than `0`/`1`, destructuring default or default parameter in `apps/api/src/services`, `apps/worker/src` or `packages/server/adapters` (AST) | `const { thresholdMs = 60 * 60 * 1000 } = options` |
| `no-test-hooks.test.ts` | no fault-injection flag or header in production source or a job contract | `request.headers['x-test-crash-after-commit']` |
| `log-calls.test.ts` | every log call carries a fixed lowercase message and puts its values in fields, in production source, scripts and the e2e runner (AST) | a template-literal message with the video id in it |
| `promql-labels-emitted.test.ts` | every label value a dashboard, alert or KEDA query selects is recorded by code that runs, parsed with `@prometheus-io/lezer-promql` and read through the type checker | `deployment=~"worker-.*"` against `vp-worker-*` Deployments |
| `minio-images-pinned.test.ts` | every MinIO image in the compose files and the chart values is pinned by digest | `image: cgr.dev/chainguard/minio:latest` |
| `production-secrets.test.ts` | `kustomize build` of the base fails `loadEnv()` under production until every secret is overridden; the cloud overlay renders no Secret value, one `ExternalSecret` entry per `SECRET_KEYS` member and no local credential | `S3_ACCESS_KEY_ID: minioadmin` rendered into the cloud overlay |
| `zero-matches.test.ts` | each counted pattern stays at the count the change that moved it left it | a second `worker-${process.pid}` default |
| `ci-shape.test.ts` | each CI job's `timeout-minutes` is its budget, the longest `needs` chain sums to 6 minutes, `unit` and the architecture suite sit behind `.github/actions/budget`, the docs-only path filter gates every job, services and `db:migrate` appear only in `integration` and `e2e-smoke`, and only `unit-bun` sets up Bun | a fixture workflow that breaks every rule |
| `load-smoke-triggers.test.ts` | the load smoke reruns on every package the API and the worker resolve at runtime, and skips a documents-only pull request | a runtime package missing from its `paths` |
| `doc-links.test.ts` | every relative link and `#anchor` in every tracked `.md` outside `.agents/` resolves, anchors slugged by `github-slugger` (markdown parsed with `markdown-it`) | `SDD.md#adr-24-result-typed-errors` for a heading with an em dash |
| `doc-commands.test.ts` | every `pnpm <script>`, `make <target>` and backticked repo path in `README.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `docs/SDD.md`, `docs/standards/`, `docs/runbooks/` and every `AGENTS.md` exists; the README tree draws exactly the workspace packages; `.PHONY` lists exactly the Makefile rules | `make up-all` with no such rule |
| `architecture-table.test.ts` | this table lists exactly the `*.test.ts` files in `tests/architecture/` | an assertion added without its row |
| `gen-index.test.ts` | `python3 docs/tickets/gen-index.py --check` passes (index current, one status vocabulary, every spec anchor real), its slug agrees with `github-slugger`, and changing a status moves the computed frontier | a ticket with `**Status:** ready-for-agent` |
| `adapter-instantiation.test.ts` | a concrete adapter is **constructed** only in a composition module or inside `@vp/adapters`, and a service or a stage constructs values only (`Date`, `Map`, `Set`, `URL`, `Promise`, `AbortController`, an `*Error`, `SseConnection`) | `new Singleflight()` inside a service |
| `total-dependencies.test.ts` | no service, stage, adapter or composition root recovers from a missing dependency: `?? new`, `\|\| new`, `?? default*`, `?? inProcessAppConfig()`, or a default parameter or destructuring default that is constructed, called or `default*` (AST) | `paginator: Paginator = defaultPaginator` |
| `no-module-state.test.ts` | outside `ENTRYPOINTS`, no module-scope `let`/`var`, no module-scope `new` other than an immutable value or a `Readonly` collection, and no top-level call statement (AST) | `export const defaultPaginator = new Paginator()` |
| `tests/in-process/start-order.test.ts` | both composition roots start every consumer after the metrics server, and the worker's after its heartbeat, read from `container.started()` | a consumer resolved before the metrics server |
| `route-plugins.test.ts` | every route module exports a Fastify plugin, carries no options interface and appears in `routes/index.ts` | a route module exporting a bare `void` registrar |
| `routes-unwrap-at-send-result.test.ts` | a route hands its `Result` to `sendResult`, turns no failure into a throw or a catch, and imports no port, repository or adapter (`health.ts` reports on the adapters themselves) | a route calling `.parse(` and throwing |
| `drain-before-close.test.ts` | the shared shutdown flips readiness before it closes, both mains use it, and `/readyz` reads the drain flag before any dependency | a shutdown that closes the server before flipping readiness |
| `shutdown-closure.test.ts` | every resource a composition module constructs registers a disposer; `dispose()` releases in reverse construction order | an adapter registered with no disposer |
| `in-memory-off-boot-path.test.ts` | neither `main.ts` reaches an `adapters/in-memory/` module on its static boot path, and the root barrel does not re-export them | a boot path that reaches the doubles through a barrel |
| `apps/api/src/__tests__/contract-drift.test.ts` | every registered Fastify route has an `@vp/api-contracts` entry, and every contract entry is routed | a route registered with no contract entry |

The contract-drift assertion stays in `apps/api` because it has to boot the app: it builds a real Fastify
instance over the in-memory adapters and reads `printRoutes()`. Moving it would make the root workspace
depend on `@vp/api`, `@vp/adapters` and `fastify` to assert something only `apps/api` can answer.

**One exception list left, shrink-only.** `tests/architecture/untested-sources.ts` records the sources that
already breached the 1:1 test mandate when it became executable. The assertion fails on a *new* breach **and**
on a listed entry that has gained its spec, so the list can only get shorter. Nothing may be appended to it.

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
