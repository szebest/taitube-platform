# 87: One composition root — a typed container, configuration as a value, and no hidden dependencies

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 84 — Result-typed error handling, domain returns and the edge decides |
| Blocks | 88 |
| Spec | [SDD ADR-19 Hexagonal architecture](../SDD.md#adr-19-hexagonal-architecture-interface-segregation-and-modular-repository-boundaries) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23-package-runtime-tiers-the-directory-is-the-tier) · [SDD ADR-24 Result-typed error handling](../SDD.md#adr-24-result-typed-error-handling-domain-returns-the-edge-decides) · [SDD §6.4 Thin transport routes](../SDD.md#64-api-layer-architecture-thin-transport-routes-domain-services) · [SDD §16 Environment variables](../SDD.md#16-environment-variables) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready-for-agent

> Review that produced this ticket: [docs/reviews/87-composition-and-configuration-review.html](../reviews/87-composition-and-configuration-review.html),
> read at `1cbb39a`. Every `file:line` below was re-read there.

---

## Why this ticket exists

**The wiring the composition root performs is not the wiring that runs.**

`apps/api/src/composition/service-set.ts:67-74` hands `VideoService` an `authorization`, a `paginator` and a
`cdnBaseUrl`. All three are optional in `VideoServiceDeps`, and `video-service.ts:77-84` recovers from each one
being absent — by constructing a `CaslAuthorizationAdapter`, by reaching for a process-wide `defaultPaginator`,
and by reading `process.env['CDN_BASE_URL']`. Delete any of those three lines from the composition root and
nothing fails: a *different* object graph boots, silently, and every test still passes.

That is a service locator wearing a constructor, and it is the reason the wiring does not feel global. It also
has a bill already due.

### The five things that are actually wrong

**1. A secret with a default, and the default is public.**

`packages/server/env-schema/src/index.ts:58` declares `ADMIN_TOKEN: z.string().default('change-me-32-bytes-random')`.
`apps/api/src/plugins/auth.ts:18` declares the *same* default again, independently. `auth.ts:45-47` grants
`role: 'ADMIN'` to any request carrying `x-admin-token` equal to it, before JWKS verification and without
provisioning. `.env.example:76` and `infra/k8s/base/configmap-secret.yaml:66` ship it as a value.

A deployment that does not set `ADMIN_TOKEN` therefore hands `/admin/*` and Bull Board to anyone who reads this
repository, and nothing fails on boot to say so. Four other secret-shaped keys carry the same shape of default:
`WEBHOOK_SIGNING_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `REDIS_PASSWORD`. **Fix this one first;
it is the only finding here that is exploitable rather than expensive.**

**2. A configuration key that nothing reads.**

| Declared | Read |
|---|---|
| `S3_BUCKET_RAW` / `S3_BUCKET_PUBLIC` — `packages/server/env-schema/src/index.ts:43-44`, `.env.example:47-48`, `infra/k8s/base/configmap-secret.yaml:20-21` | nowhere |
| nowhere | `STORAGE_RAW_BUCKET` / `STORAGE_PUBLIC_BUCKET` — `apps/api/src/app.ts:52`, `services/upload-service.ts:80`, and eight worker stages |

`.env.example:57-58` documents `S3_BUCKET_RAW=vp-raw` as the cloud setting. Setting it does nothing. Every
reader falls through to the literal `'raw'`, so the R2 deployment from ticket 32 addresses whichever bucket
happens to be called `raw`. Two spellings of one contract, and the validated one is the dead one — which is
precisely what SDD §16 says cannot happen, because config "is one contract for both apps, declared with zod".

**3. Nothing shuts the API down.**

`apps/api/src/main.ts` installs no `SIGTERM` or `SIGINT` handler, so the `onClose` hook at `app.ts:110-115`
never runs in production. The hook is partial anyway: it closes the category cache and the SSE hub, and leaves
the Postgres pool, the Redis client, the storage client and eight BullMQ queues open. `apps/worker/src/main.ts:41-51`
gets this right. Under a rolling deploy or a KEDA scale-in the API drops in-flight requests and orphans its
connections; the worker, on the same cluster, drains cleanly.

**4. Two environment detections, and the worker's is the shape an invariant already bans.**

`composition/adapter-set.ts:33-39` carries a comment explaining why the family of adapters is a *parameter*:
the inference it replaced compared `constructor.name` against a string literal, and a minifier would have
flipped it to production adapters. `apps/worker/src/runner.ts:88-91` still infers — `options.jobQueue instanceof
InMemoryJobQueue || options.repositories instanceof InMemoryRepositories || process.env['NODE_ENV'] === 'test'`.
The fixture `tests/architecture/class-name-inference.test.ts:59` uses to prove itself fires is
`queue.constructor.name === 'InMemoryJobQueue'`: the same decision, one refactor away from the banned form.

**5. One value, four fallback chains, and the odd sibling is empty.**

The CDN base is resolved and stripped of its trailing slash in four places: `video-service.ts:83-84`,
`sse-service.ts:116-117`, `worker/src/stages/package.ts:56,62` and `subscription-service.ts:55`. The last one is
`(options.cdnBaseUrl ?? '').replace(/\/+$/, '')` — no env read, no default. Built without that option it emits
relative thumbnail URLs while every sibling emits absolute ones. Nothing in the types says which behaviour is
intended, because the value has no type: it is a `string` that four modules each promise to have cleaned.

### What this ticket does not claim

**No decorator container, no reflection, no new runtime dependency.** `@Injectable()` resolving by type needs
`emitDecoratorMetadata` and a `reflect-metadata` polyfill in the eager path of both deployables; TC39 standard
decorators carry no parameter types, so that ecosystem is pinned to the legacy flag indefinitely, and
transpiler-level behaviour is exactly what Rule 2 (dual-runtime parity) exists to keep out. It also trades a
compile error for a runtime one: forget `reactionCache` today and TypeScript names the call site.

**The 45 direct `new XService({…})` calls in unit tests stay.** Building a service with exactly the
collaborators a case touches is a feature, and `Test.createTestingModule` is the tax NestJS charges for it.

**`buildApp(options)` keeps its signature.** All 32 call sites, including `tests/e2e/in-process-env.ts`, compile
unchanged; the options object becomes container overrides internally. This ticket changes the shape of the
wiring, not the shape of the test seam.

---

## The shape

```ts
// @vp/composition — the entire mechanism, no dependency, no reflection, no cast
export interface Token<T> { readonly name: string; readonly _t?: (x: T) => T }
export const token = <T>(name: string): Token<T> => ({ name });

export class Container {
  provide<T>(t: Token<T>, make: (c: Container) => T): this   // `make` is SYNCHRONOUS
  get<T>(t: Token<T>): T                             // lazy, memoised, cycle-detecting
  override<T>(t: Token<T>, value: T): this           // tests; throws once resolved
  start(): Promise<Result<void, StartupFailed>>      // phase 2, construction order
  dispose(): Promise<Result<void, ShutdownFailed>>   // reverse construction order, idempotent
}

// Anything that needs I/O before it is usable declares it, instead of doing it in a factory.
export interface Startable { start(): Promise<Result<void, AnyFailure>> }
```

**Construction is synchronous; starting is not.** Two things in today's graph do I/O while the graph is being
built: `SseHub.init()` opens a Redis subscription at `service-set.ts:82`, and `registerHousekeepingSchedulers`
writes repeatable jobs at `app.ts:57`. If `get` were async every call site would be `await`-coloured and the
container would become a scheduler. Instead a factory returns a constructed object, and when that object needs
I/O the container collects it as a `Startable` that `start()` runs in construction order.

That split is the one W5 needs anyway: `buildApp` resolves the graph and registers routes, `main.ts` calls
`start()`. It is also why `buildApp()` in a test opens no socket - nothing calls `start()`.

`get` returns `T` with no cast, because the token carries the type. Registration reads like a `@Module`, and the
compiler checks every edge:

```ts
c.provide(Storage, (c) =>
  c.get(Config).kind === 'in-memory'
    ? new InMemoryStorageClient()
    : new S3StorageClient(c.get(Config).s3));

c.provide(VideoService, (c) => new VideoService({
  videos:        c.get(Repositories).videos,
  authorization: c.get(Authorization),
  paginator:     c.get(Paginator),
  reactionCache: c.get(ReactionCache),
  probeQueue:    c.get(Queues).get('probe'),
  cdn:           c.get(Config).cdn,
}));
```

Nothing in it is Fastify-specific, so `apps/worker` registers the same adapter half and adds its stages — which
is what deletes the second environment detection rather than fixing it twice.

At the transport edge the container is Fastify's own. `app.decorate('services', …)` with one `declare module
'fastify'` — the mechanism `request.user` already uses at `plugins/auth.ts:32-36` — retires thirteen
hand-written `*RouteOptions` interfaces and lets every route module become a plugin registered from one table.

**The ordering matters: W2 and W3 land before W1 is used.** A container registered over optional dependencies
would reproduce today's ambiguity behind a nicer API, and the ambiguity is the defect.

---

## What to build

### W1 — `@vp/composition` (new package, `packages/server/composition`, tier `server`, layer **T2**)

The mechanism and nothing else. Target ≤ 150 lines across `container.ts` and `token.ts`.

- `Token<T>` carries its type phantom-style; `token<T>(name)` is the only constructor. The `name` is for error
  messages, never for lookup — resolution is by token identity.
- `provide` registers a factory. Re-providing a token that has already been resolved is a programmer error and
  throws at registration time, not at resolution time.
- `get` is lazy and memoises per container. A cycle throws with the full resolution path in the message
  (`Config → Storage → Multipart → Storage`).
- `override(token, value)` replaces a registration before first resolution; after it, it throws.
- A factory is **synchronous**. A factory that needs to `await` is a `Startable` (see *The shape*); the container
  refuses an async factory at registration, because a promise memoised as a value is a race nobody reads.
- `start()` runs every resolved `Startable` in construction order and stops at the first `Err`, disposing what
  already started. Nothing that was never resolved is started.
- `dispose()` runs registered disposers in reverse construction order and aggregates their `Result`s. A disposer
  is registered by the factory that created the resource, so ordering is derived, not declared. It is
  **idempotent**: `SIGTERM` followed by `SIGINT` must not close a pool twice.
- **Tier and layer:** `server`, because nothing client-side imports it (packages/AGENTS.md §1). **T2**, because
  `dispose()` speaks `Result` from `@vp/result` (T1) — a T1 declaration would be a forbidden sibling edge.

### W2 — Configuration is a value

- `AppConfig` and `toAppConfig(env: AppEnv): AppConfig` land in **`@vp/env-schema` (T3)**, which already owns
  `AppEnv`. `@vp/config` (T4) keeps only `loadEnv()`. This is what lets `@vp/adapters` (T4) take an `AppConfig`
  without a sibling edge.
- `AppConfig` is shaped for consumers, not for the environment: `{ kind, cdn, buckets, limits, sse, s3, redis,
  postgres, otel, worker }`. `kind: AdapterKind` is derived once from `NODE_ENV` and is the **only** switch
  between in-memory and external adapters in the repo.
- `CdnBase` is a branded string. `asCdnBase(raw)` strips trailing slashes **once**, in config. The four
  in-service normalisations are deleted; `video-views.ts:77` keeps its leading-slash join, which is a different
  job.
- **Reconcile the bucket keys on `S3_BUCKET_RAW` / `S3_BUCKET_PUBLIC`** — the spelling already declared in the
  schema, `.env.example` and the k8s ConfigMap. Every `STORAGE_*_BUCKET` read is deleted. Check
  `infra/compose/`, `infra/k8s/`, `.github/workflows/` and `Makefile` for the dead spelling in env blocks.
- Every `process.env` read outside `@vp/config`, `@vp/env-schema`, `apps/*/src/main.ts`, the CLI packages and
  `@vp/testing` is deleted — 11 in `apps/api/src`, 20 across `apps/worker/src`. Worker stages take their config
  from the stage deps object instead of a default parameter; `apps/worker/src/config.ts` folds into `AppConfig`.
- `apps/worker/src/main.ts` calls `loadEnv()` the way `apps/api/src/main.ts` already does, and passes the config
  into `createWorkerRunner`.
- **No secret-shaped key carries a default.** `ADMIN_TOKEN`, `WEBHOOK_SIGNING_SECRET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY` and `REDIS_PASSWORD` become required in `AppEnv`. Local development gets its values
  from `.env.example` and the compose file, which is where a development credential belongs; a process booting
  with `NODE_ENV=production` and a missing or well-known secret fails at `loadEnv()` with the readable list it
  already produces, instead of serving. The second, independent default at `apps/api/src/plugins/auth.ts:18` is
  deleted with the rest of the ambient reads.
- The `.env.example` and `configmap-secret.yaml` values keep their placeholder text, because a placeholder that
  a schema now refuses to accept in production is a prompt rather than a credential.

### W3 — Dependencies become total

- Delete all seven self-construction fallbacks, across six files: `video-service.ts:77,78`, `feed-service.ts:46`,
  `category-service.ts:53`, `dlq-service.ts:59`, `subscription-service.ts:56`, `queue-service.ts:50`. Every one
  becomes a required dependency.
- `VideoServiceDeps extends VideoLifecycleDeps`, so the `this.lifecycle = { videos, …probeQueue }` projection at
  `video-service.ts:79-82` disappears. The constructor body goes to zero statements:
  `constructor(private readonly deps: VideoServiceDeps) {}`.
- Delete the 25 `...(x === undefined ? {} : { x })` spreads. `exactOptionalPropertyTypes` is set in no tsconfig
  in this repo, so each is assignment-equivalent to `x`.
- `apps/api/src/services/` stops importing `@vp/adapters`:
  - `video-service.ts:1` — `CaslAuthorizationAdapter` becomes a required `AuthorizationPort`.
  - `category-service.ts:1` — a new **`CategoryCachePort` in `@vp/core/ports`**. Two of the three cache
    collaborators already have ports (`reaction-cache.ts`, `subscription-cache.ts`); the third is a concrete
    class the service names directly. Rename the adapter `RedisCategoryCacheAdapter` to match its siblings.
  - `feed-service.ts:1` — `Singleflight`, see W6.

### W4 — One registration surface

- `registerAdapters(c: Container, config: AppConfig)` lives in `@vp/adapters` (T4 → env-schema T3, composition
  T2, both downward). It owns every adapter class and every in-memory double already; it registers both families
  behind `config.kind`.
- `apps/api/src/composition/services.module.ts` registers the twelve services and `ServiceSet`.
- `apps/worker/src/composition/stages.module.ts` registers the stage processors, replacing the `if/else` chain
  at `runner.ts:123-178` with a registry keyed by stage — `STAGE_REGISTRY` already exists and should carry the
  factory.
- `runner.ts:88-91` is deleted: the worker reads `config.kind` like the API does.
- `resolveAdapterSet` and `createServiceSet` become thin readers over the container, kept only as long as the
  `AdapterOverrides` test seam needs them.

### W5 — The API edge

- Every module under `apps/api/src/routes/` exports a Fastify plugin: `async function videosRoutes(app: FastifyInstance)`.
  Dependencies come from `app.services`, not an options object; the thirteen `*RouteOptions` interfaces are deleted.
- `app.decorate('services', services)` and `app.decorate('config', config)`, with one `declare module 'fastify'`
  block beside the existing `request.user` augmentation.
- `buildApp` registers plugins from **one table** — `[healthRoutes, uploadsRoutes, videosRoutes, …]` — with a
  uniform `await app.register(plugin)` each. This is the answer to the inconsistent awaits: they were never
  wrong (Avvio preserves registration order either way, and nothing between them reads a decorator the previous
  one installed), they were the residue of thirteen calls that were never given one shape.
- `buildApp` starts nothing: it resolves the graph and registers routes, and `main.ts` calls `container.start()`.
  Both pollers, `SseHub.init()` and `registerHousekeepingSchedulers` become `Startable`s. 30 of the 32
  `buildApp` call sites are tests that want routes, not timers and not a Redis subscription.
- `apps/api/src/main.ts` installs `SIGTERM`/`SIGINT` → `app.close()` → `onClose` → `container.dispose()`, with a
  drain timeout, matching `apps/worker/src/main.ts:41-51`. `dispose()` closes the Postgres pool, the Redis
  client, the storage client, all eight queues, the SSE hub, the category cache and both pollers.
- **The drain is observable, not just internal.** A shutdown flips a lifecycle flag that `/readyz`
  (`routes/health.ts:31-55`) reads *first*, so the endpoint answers 503 the moment `SIGTERM` lands while the
  server is still accepting and finishing in-flight requests. `/livez` keeps answering 200 until the process
  exits, which is the distinction the two probes exist for and which the current handler does not make.
- **Something has to wait for the drain.** `infra/k8s/base/api.yaml` sets no `terminationGracePeriodSeconds`
  and no `preStop`, so today kubelet's 30s default races an ingress that is still routing. This ticket sets
  both on the API and on all eight worker deployments, and sets `stop_grace_period` plus an explicit
  `STOPSIGNAL` in `infra/compose/`. A drain nobody waits for is not a drain.
- A forced exit after the grace window, logged, so a wedged disposer cannot hold a pod open until it is killed.

### W6 — Placement

- **`@vp/concurrency`** (new package, `packages/server/concurrency`, tier `server`, layer **T1**): `Singleflight`
  moves out of `packages/server/adapters/redis/`, where it has been a `Map<string, Promise>` with no Redis in it,
  imported by `FeedService` across the service→adapter edge. Its two consumers (`feed-service.ts:41`,
  `redis-reaction-cache.adapter.ts:24`) both import it from there. A package is the consistent answer at these
  layers — `@vp/events` is 145 lines — and an exception list naming one symbol is the mechanism ticket 82 spent
  its effort removing.
- **`HttpCacheService` becomes three functions** in `apps/api/src/services/http-cache.ts`: 81 lines, three
  methods, zero state, injected into two services that each also construct their own. Imported, not injected.
  Delete `httpCacheService` from `FeedServiceDeps` and `CategoryServiceDeps`.
- **`AuthUser` is read from `@vp/permissions`.** The eleven service modules importing it from `../plugins/auth`
  import `UserContext` directly; `plugins/auth.ts` keeps the Fastify augmentation and drops the re-export alias.

### W7 — Machine enforcement, docs and standards

New assertions in `tests/architecture/`, each with the fixture that proves it fires:

| Assertion | Holds | Fixture |
|---|---|---|
| `env-key-closure.test.ts` | every env key read in production source is declared in `@vp/env-schema`; every schema key appears uncommented in `.env.example`; and **every key set in `infra/compose/`, `infra/k8s/`, `.github/workflows/` or the `Makefile` exists in the schema** | `process.env['STORAGE_RAW_BUCKET']`, and a `STORAGE_RAW_BUCKET:` line in a compose env block — **this is the assertion that would have caught the dead bucket key on the day it was written, from both directions** |
| `no-defaulted-secrets.test.ts` | no key whose name matches `TOKEN\|SECRET\|PASSWORD\|ACCESS_KEY` carries a `.default()` in `@vp/env-schema`, and no production source holds a literal fallback for one | `ADMIN_TOKEN: z.string().default('change-me-32-bytes-random')`, and `process.env.ADMIN_TOKEN \|\| 'change-me-32-bytes-random'` |
| `adapter-instantiation.test.ts` | a concrete adapter is **constructed** only in a composition module or `@vp/testing` — not merely imported there | `new CaslAuthorizationAdapter()` inside `video-service.ts`, which the import rule alone would miss once the class is re-exported |
| `drain-before-close.test.ts` | `/readyz` answers 503 once shutdown begins while the server is still accepting, and `/livez` keeps answering 200 until exit | a shutdown that closes the server before flipping readiness |
| `env-confinement.test.ts` | `process.env` appears only in `@vp/config`, `@vp/env-schema`, `apps/*/src/main.ts`, CLI entrypoints and `@vp/testing` | an env read added to a service |
| `total-dependencies.test.ts` | no constructor under `apps/api/src/services/` or `apps/worker/src/stages/` recovers from a missing dependency (`?? new`, `|| new`, `?? default*`) | `deps.paginator ?? defaultPaginator` |
| `route-plugins.test.ts` | every module under `apps/api/src/routes/` exports a Fastify plugin and appears in the registration table | a route module exporting a bare `void` registrar |
| `sdk-confinement.test.ts` (extended) | `@vp/adapters` is imported only from composition modules and `@vp/testing` — never from `apps/api/src/services/` | `import { CaslAuthorizationAdapter } from '@vp/adapters'` in a service |
| `shutdown-closure.test.ts` | every resource the container constructs registers a disposer; `dispose()` runs them in reverse construction order | an adapter registered with no disposer |

Docs, in the same PR:

- **SDD ADR-25 — Composition: one container, configuration is a value.** Records the container, the rejection of
  reflection-based DI with the dual-runtime reason, and `AdapterKind` as the single environment switch.
- **SDD §16** — correct the bucket keys and note that the schema is closed over what the code reads.
- **ARCHITECTURE.md** — Invariant 8 (*configuration is a value, dependencies are total*) and Invariant 9
  (*a process drains before it closes*) in §5, plus the nine new rows in the §6 enforcement table.
- **SDD §11 Security** — record that no secret-shaped key may carry a default and that production boot fails
  without one, with the `x-admin-token` path named as the reason.
- **SDD §6.4** — delete the sentence mandating "a **>1:1 ratio of services to routes**". A ratio is a target
  with no consumer, and it is currently satisfied by classing three pure functions (`HttpCacheService`) and by
  filing a promise map under adapters (`Singleflight`). ARCHITECTURE.md §6 already says an invariant that cannot
  be asserted is deleted rather than left as decoration; this one can be asserted and is false.
- **`apps/api/src/routes/README.md`** — its worked example shows `options.channelService ?? new ChannelService({ … })`,
  the exact anti-pattern W3 removes, and a signature that will no longer exist.
- **`CLAUDE.md`** rules 3 and 4, and `apps/api/AGENTS.md`, `apps/worker/AGENTS.md`, `packages/server/adapters/AGENTS.md`.

### W8 — Pay for what this ticket rewrites

`tests/architecture/untested-sources.ts` exempts **188 of 488 production sources** from the mandated 1:1 test
correspondence — 39%, against a rule `CLAUDE.md` calls a strict architectural violation to break. The list is
shrink-only, so it never gets worse; it also never gets better on its own. This ticket takes the part it caused
and the part that is the rule's own fault, and ticket 88 takes the rest.

- **Narrow the rule, and delete 31 entries honestly.** 31 of the 188 are declaration-only files — pure `type`,
  `interface` and `abstract class` with no runtime code, mostly `@vp/core/repositories` (12) and
  `@vp/core/ports` (7). A spec for `packages/server/core/ports/authorization.ts` (16 lines, one abstract class,
  zero behaviour) asserts that TypeScript compiles. `test-correspondence.test.ts` stops treating a source with
  no runtime code as a correspondence target, and those 31 leave the list because the rule was wrong, not
  because the code got tested.
- **Every file this ticket rewrites leaves the list.** All 14 route modules become plugins, `runner.ts` is
  restructured, `config.ts` is deleted, `plugins/auth.ts` loses its ambient reads, and two services change
  shape: **≈19 entries**, each paid for with a real spec, not a smoke test.
- **The two new packages are 1:1 from birth** and never appear on the list.
- Net: **188 → ≈138**, correspondence **61% → ≈72%**. The residue is 73 in `packages/server` adapters and 55 in
  `apps/web`; both are [88](88-test-correspondence-burn-down.md), because writing ~130 specs is a bigger job
  than everything above it put together and hiding it inside this ticket would make neither deliverable.

---

## What this ticket moves

Measured at `9d11fdc`, projected on the acceptance criteria below. The numbers are a target for the
implementer, not a claim.

| Dimension | Today | After 87 | What closes it |
|---|---|---|---|
| Configuration | 3 | **9** | W2, and the env closure asserted in both directions |
| Lifecycle & operability | 3 | **9** | W5: drain, readiness flip, grace periods, forced exit |
| Authorization | 8 | **9** | W2: no defaulted secret, production boot fails without one |
| Dependency injection | 5 | **9** | W1, W3, W4: one surface, total deps, one environment switch |
| Boundaries & structure | 7 | **9** | W6, and instantiation asserted rather than only imports |
| Drift resistance | 8 | **9** | W7: nine assertions, no new exception list |
| Error handling | 9 | 9 | unchanged — 84 did this |
| Test discipline | 6 | **7.5** | W8; reaching 9 is [88](88-test-correspondence-burn-down.md) |

---

## Acceptance criteria

### W1 — `@vp/composition`
- [ ] `container.get(VideoServiceToken)` types as `VideoService` with no type argument and no cast.
- [ ] A factory is invoked at most once per container; a token never resolved is never invoked (assert with a spy).
- [ ] A registration cycle throws with every token name on the path, in order.
- [ ] `override` after resolution throws; `override` before resolution wins.
- [ ] A factory returning a promise is refused at registration, with the token name in the message.
- [ ] `start()` starts only resolved `Startable`s, in construction order; a failing one disposes what already started and returns `Err`.
- [ ] `dispose()` returns `Err` naming every disposer that failed, and still runs the remaining ones.
- [ ] `dispose()` called twice closes each resource exactly once.
- [ ] `pnpm boundaries` passes with the package declared `server` / T2; the package has no `@vp/*` dependency beyond `@vp/result`.

### W2 — Configuration
- [ ] `grep -rn "process\.env" apps/*/src packages/*/*/src --include='*.ts'` outside the five allowed homes returns nothing.
- [ ] `S3_BUCKET_RAW=vp-raw` in `.env` changes the key the API presigns against — proved by a test, not by reading.
- [ ] `STORAGE_RAW_BUCKET` and `STORAGE_PUBLIC_BUCKET` appear nowhere in the repo, including infra and CI.
- [ ] `asCdnBase('http://cdn/x///')` and `asCdnBase('http://cdn/x')` produce the same `CdnBase`; no module outside `@vp/env-schema` strips a trailing slash from it.
- [ ] A `SubscriptionService` built from the container emits the same absolute thumbnail URL as `VideoService` for the same video.
- [ ] `apps/worker/src/config.ts` is deleted and `WORKER_STAGE` reaches the runner through `AppConfig`.
- [ ] No `.default()` on a key matching `TOKEN|SECRET|PASSWORD|ACCESS_KEY`, and no literal fallback for one anywhere in production source.
- [ ] `NODE_ENV=production` with `ADMIN_TOKEN` unset fails at `loadEnv()` and never binds a port — proved by a test, and by a second test that the same env boots fine under `development`.
- [ ] Sending `x-admin-token: change-me-32-bytes-random` to a production-configured app is rejected. That request is admitted today.

### W3 — Total dependencies
- [ ] `VideoService`'s constructor body is empty; `VideoServiceDeps extends VideoLifecycleDeps`.
- [ ] No service constructor contains `??` or `||` against a constructed value.
- [ ] Zero `...(x === undefined ? {} : { x })` spreads remain in `apps/api/src` and `apps/worker/src`.
- [ ] `apps/api/src/services/` imports nothing from `@vp/adapters`, and instantiates no adapter (asserted, not grepped).
- [ ] `CategoryCachePort` is in `@vp/core/ports` with an in-memory double, and `CategoryService` names the port.

### W4 — Registration
- [ ] One `AdapterKind` decision in the repo. `grep -rn "instanceof InMemory" apps/ --include='*.ts'` outside `packages/server/adapters/in-memory/` returns nothing.
- [ ] `apps/api` and `apps/worker` register the same adapter module; neither imports an SDK (`sdk-confinement` still green).
- [ ] The worker stage `if/else` chain is replaced by `STAGE_REGISTRY`; adding a stage is one registry entry.
- [ ] `buildApp({ adapters: { storage: fake } })` still overrides, and all 32 existing call sites compile unmodified.

### W5 — The API edge
- [ ] Every route module is a Fastify plugin; `buildApp` registers them from one array with one uniform `await`.
- [ ] No `*RouteOptions` interface remains in `apps/api/src/routes/`.
- [ ] `buildApp()` creates no timer and opens no subscription — asserted by a test that builds an app and finds no pending handles.
- [ ] `SIGTERM` closes the HTTP server, then disposes the container; a test drives `main()`'s exported shutdown and asserts every adapter's `close` was called exactly once, in reverse construction order.
- [ ] The API's shutdown path matches the worker's: both drain, both log, both exit 0.
- [ ] A request in flight when `SIGTERM` arrives completes with its normal response — driven against a real `listen()` and a slow route, not a mocked server.
- [ ] `/readyz` answers 503 within one event-loop turn of `SIGTERM` while `/livez` still answers 200, and the server is still accepting at that moment.
- [ ] `terminationGracePeriodSeconds` and a `preStop` hook are set on the API and all eight worker deployments; `stop_grace_period` and `STOPSIGNAL` are set in compose. Quote the values and say what they are derived from.
- [ ] A disposer that never resolves does not hold the process past the grace window; the forced exit is logged with the disposer's name.

### W6 — Placement
- [ ] `@vp/concurrency` exists at T1 with `Singleflight` and its spec; `packages/server/adapters/redis/singleflight.ts` is gone.
- [ ] `HttpCacheService` is gone; three exported functions carry its behaviour and its tests.
- [ ] `grep -rn "from '../plugins/auth'" apps/api/src/services/` returns nothing.

### W7 — Enforcement & docs
- [ ] Nine new assertions green, each with a fixture proving it fires; `pnpm test:architecture` stays under 2 s.
- [ ] `env-key-closure` fails on a key set in a compose or k8s env block that the schema does not declare, and on a schema key missing from `.env.example`.
- [ ] `adapter-instantiation` fails on `new CaslAuthorizationAdapter()` inside a service even when the import is legal.
- [ ] SDD ADR-25 written; §16 corrected; §6.4's ratio sentence deleted; ARCHITECTURE.md §5 and §6 updated.
- [ ] `apps/api/src/routes/README.md` matches the code it documents.
- [ ] No exception list is added, and none of the five existing shrink-only lists grows.

### W8 — Test correspondence
- [ ] `untested-sources.ts` is at **≈138 entries or fewer**, down from 188. Quote the exact before and after.
- [ ] The 31 declaration-only entries are gone because `test-correspondence.test.ts` no longer targets a source with no runtime code — with a fixture proving the narrowed rule still fires on a file that does have runtime code.
- [ ] Every file this ticket rewrites has a real spec beside it. A spec that only asserts a module imports is not one; it fails review.
- [ ] `@vp/composition` and `@vp/concurrency` never appear on the list.
- [ ] The other four shrink-only lists are unchanged or shorter.

### Repo-wide
- [ ] `pnpm boundaries`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, output pasted in the PR.
- [ ] `make smoke-offline` green; `make e2e` (`E2E_REDUCED=true`) green.
- [ ] `pnpm test` wall-clock is not slower than `1cbb39a`; quote both numbers. Removing 30 test-time poller pairs should make it faster.

---

## Out of scope

- **Enabling `exactOptionalPropertyTypes`.** W3 deletes ceremony that guards a flag nobody set; turning the flag
  on is a repo-wide change with its own blast radius and its own ticket.
- **Request-scoped resolution.** The caller is already an explicit argument to every service method; a request
  scope would be an extension point with no consumer.
- **Rebranding `@vp/*` to `@taitube/*`** — that is ticket 48, and doing both at once makes either unreviewable.
- **Moving authorization, caching or pagination behaviour.** This ticket changes how collaborators arrive, never
  what they do. Any behavioural difference is a bug in this ticket.
- **The other ~138 exempt sources.** 73 in `packages/server` adapters and 55 in `apps/web`. That is
  [ticket 88](88-test-correspondence-burn-down.md), which this ticket unblocks by narrowing the rule first so
  88 is not writing 31 specs that assert nothing.
- **Rotating or re-scoping the `x-admin-token` path.** W2 makes the credential real; whether a shared admin
  header should exist beside JWKS at all is a design question with its own blast radius.
- **`apps/web`.** Nothing here crosses the client tier.

---

## Notes for the implementer

- **Land W2 and W3 first, in that order, and prove the graph is total before introducing the container.** Once
  no service can invent a collaborator, the container is a mechanical transcription of `service-set.ts` and the
  diff is boring — which is the point.
- The bucket-key reconciliation is the one change that alters running behaviour in the cloud overlay. Do it in
  its own commit with its own test, so it can be reverted alone.
- `registerAdapters` living in `@vp/adapters` is a layer decision, not a convenience: `@vp/config` is T4 and
  `@vp/adapters` is T4, so the config *type* has to sit at T3 for that edge to point down. If you find yourself
  wanting `@vp/adapters → @vp/config`, the type is in the wrong package, not the layer rule in the wrong place.
- Fastify decorators are inherited by child contexts, so `app.decorate('services', …)` before the route
  registrations is enough; do not decorate per plugin.
- `app.register()` is deferred — Avvio runs the boot queue at `ready()`/`listen()` in registration order whether
  or not you await. Await uniformly because uniform is readable, not because ordering needs it.

---

## Testing plan

- **Unit:** the container (resolution, memoisation, cycles, overrides, dispose ordering and aggregation);
  `toAppConfig` over a full `.env.example` parse and over the minimum viable env; `asCdnBase` cases.
- **Migration safety:** the existing 45 service unit tests are edited only where a dependency became required.
  A test whose *behaviour* had to change means this ticket changed behaviour — stop and say so in the PR.
- **Shutdown:** build an app over in-memory adapters, `close()` it, assert every adapter's `close` ran exactly
  once in reverse construction order and no timer survives.
- **Config reach:** a test that sets `S3_BUCKET_RAW` to a non-default value and asserts the presigned key names
  that bucket — the regression test for the defect this ticket exists to close.
- **Dual runtime:** `pnpm test:bun` must pass unchanged; the container uses no runtime-specific API.

---

## Open questions

- **A decorator container instead?** *Decided: no.* It needs `emitDecoratorMetadata` plus a `reflect-metadata`
  polyfill in the eager path of both deployables, TC39 decorators carry no parameter types so the ecosystem is
  pinned to the legacy flag, and transpiler-level behaviour is what Rule 2 exists to keep out. A typed token
  gives the same call-site ergonomics with a compile-time graph and no dependency.
- **Should routes resolve from the container directly?** *Decided: no.* `app.decorate('services', …)` is
  Fastify's own container and it is what the repo already uses for `request.user`. Handing route modules the
  application container would make them service locators over the whole graph.
- **`Singleflight`: new package or allowlist entry?** *Decided: `@vp/concurrency` at T1.* Two consumers at
  different layers, 33 lines, no seam (one implementation, so no port). The repo's precedent is small
  single-purpose packages — `@vp/events` is 145 lines — and an exception list naming one symbol is exactly what
  ticket 82 removed.
- **Where does `AppConfig` live?** *Decided: `@vp/env-schema` (T3), with `loadEnv()` staying in `@vp/config` (T4).*
  It is the only placement that lets `@vp/adapters` take a config without a sibling edge.

---

## Definition of Done

All acceptance criteria ticked with pasted evidence · branch `ticket/87-composition-root-typed-container-config-value`
· PR reviewed and approved · all CI checks green · `**Status:** done` and `python3 docs/tickets/gen-index.py`
re-run · SDD, ARCHITECTURE.md and the affected `AGENTS.md` files updated in the same PR · no new external runtime
dependency · no exception list added or grown.
