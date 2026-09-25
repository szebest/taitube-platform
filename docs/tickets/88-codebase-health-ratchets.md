# 88: Codebase health to nine: every scorecard dimension at 9+, each one held by a ratchet

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | XL (delivered as six PRs, see *Delivery*) |
| Blocked by | 87 — One composition root, a typed container and configuration as a value |
| Blocks | 89, 90 |
| Spec | [SDD ADR-19 Hexagonal architecture](../SDD.md#adr-19--hexagonal-architecture-interface-segregation-and-modular-repository-boundaries) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [SDD ADR-24 Result-typed error handling](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) · [SDD §6.4 Thin transport routes](../SDD.md#64-api-layer-architecture-thin-transport-routes--domain-services) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13 Autoscaling & Observability](../SDD.md#13-autoscaling--observability) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §16 Environment variables](../SDD.md#16-environment-variables) |

**Status:** done

> Audit behind this ticket: [docs/reviews/88-codebase-health-audit.md](../reviews/88-codebase-health-audit.md),
> read at `64eff79` (87 merged). Every count below was re-measured there, with the command that reproduces it.

---

## Why this ticket exists

87 fixed the wiring. What is left is not one defect but a spread of them, and the spread is the problem: every
dimension sits between 4 and 8, and each one is held down by debt that no test would notice coming back.

This ticket is the bar. After it, **every dimension on the scorecard scores 9 or better, and every AC that got it
there is a machine check** - an assertion under `tests/architecture/`, a lint rule at error level, a CI gate, or a
command whose expected output is `0`. A criterion a reviewer has to remember to check is not one here.

It also retires the mechanism the repo has been living on. Four shrink-only lists exist (`untested-sources.ts`
130, `legacy-catch-sites.ts` 22, `oversized-sources.ts` 5, `routes-outside-send-result.ts` 0). Shrink-only is right
while a rule is new; it is wrong as a steady state, because a list nobody burns down is an exemption. **At the end
of 88 all four lists are empty and deleted, and so is `shrinkOnly`.** Every rule is a flat assertion.

### The one finding to fix first

**Anyone can mint an admin token against a production-configured API.**

`apps/api/src/routes/index.ts:20` registers `devJwksRoutes` in every environment. It serves the dev key derived from
a seed that is committed to the repo (`packages/server/dev-token/src/keys.ts:23`). The k8s base points production
at exactly that route (`infra/k8s/base/configmap-secret.yaml:28`, `AUTH_JWKS_URL: http://vp-api:3000/.well-known/jwks.json`),
the cloud overlay does not override it, and `auth.ts:82` trusts the `role` claim. So `pnpm dev-token mint --role admin`
produces a token the JWKS path accepts, with `devTokens` off. `iss` and `aud` are never compared either
(`jwks-verifier.ts:177-187` checks `exp`, `nbf` and `sub` only), so no configuration of the verifier stops it.

It ships in the first PR (88a), ahead of everything else.

### What the audit found that the last scorecard did not

| Finding | Where |
|---|---|
| `x-test-crash-after-commit: true` makes any authenticated client crash an upload after commit, in production | `apps/api/src/routes/uploads.ts:121`, `services/upload-complete.ts:185` |
| The migrate Job seeds the dev user and a READY video into every database, production included | `apps/api/src/migrate.ts:3,12` (imports `@vp/db/seed`), run by the Job as `node dist/migrate.js` |
| The cloud overlay never includes its secrets; the "encrypted" file is plaintext in fake `ENC[...]` wrappers | `infra/k8s/overlays/cloud/kustomization.yaml:6-10`, `secrets.enc.yaml` |
| The API writes no logs at all - `fastify({ logger: false })`, so an unhandled 500 goes nowhere | `apps/api/src/app.ts:47`, `plugins/errors.ts:85` |
| Each worker sets `bullmq_queue_jobs{state="active"}=1` and never resets it, so KEDA cannot scale it to zero | `apps/worker/src/composition/stages.module.ts:46`, `infra/k8s/base/scaled-objects.yaml` |
| `WorkerStalledJobs` alerts on `result="stalled"`, which nothing emits; KEDA queries `state="prioritized"`, which nothing emits | `infra/observability/alerts/video-pipeline-alerts.yaml:56`, `apps/api/src/services/queue-poller.ts:7-14` |
| `/readyz` reports S3 ok unconditionally - both S3 `checkHealth` are `return ok()` | `adapters/s3/s3-storage-client.ts:76`, `s3-multipart-storage.ts:41` |
| The `integration` job integrates nothing: `test:integration` is `vitest run`, no spec reads a real Postgres, Redis or MinIO | `apps/api/package.json`, `packages/server/db/package.json` |
| 12 repository contract suites already exist, bundled into one file - which is itself a rule-12 violation | `packages/server/adapters/__tests__/contract/repositories.contract.test.ts` |
| Every CI job rebuilds all apps: five jobs race for one turbo cache key and only the first save wins | `.github/workflows/ci.yml`, run 35842380274 (`0 cached, 27 total` in three jobs) |
| `sync-tickets` has failed on every push to `main` since 09-19 (`GH006`, it pushes to a protected branch) | `.github/workflows/sync-tickets.yml` |
| The nightly load smoke failed 4 of 5 nights; three of them at 100% `http_req_failed`, an outage, not a flake | `load-smoke.yml` runs 35428692251, 35497372031, 35574829996 |
| A bodyless `complete` with `content-type: application/json` answers **500**, not 400: FST 4xx errors fall through the error handler | `apps/api/src/plugins/errors.ts:44-95` |
| `bad-codec.mov` is in the CI e2e set and nothing generates it; CI never runs `make e2e`, so nobody saw | `tests/e2e/specs.ts:250`, `packages/server/gen-video/manifest.json` |
| 36 discarded `Result`s, not 4, and `catch-confinement` cannot see `.catch(` (20 in services and stages) | see W5 |
| 129 broken `#anchor` links - the SDD's em-dash headings slug to a double hyphen and every link uses one | see W11 |
| `accessible-by.ts` and `rules-to-sql.ts` are **not** dead - three scopes reach them. Only two of their exports are | refutes the old scorecard |

---

## The scorecard

Scores at `64eff79`. The old table scored some rows higher; the audit found more under them.

| Dimension | Today | Target | Proof (the gate that holds the target) |
|---|---|---|---|
| Security & authorization | 4 | 9.5 | `auth-hardening` suite (forged dev token, wrong `iss`/`aud`, unknown `alg`, kid-less token) all 401 under `production`; `no-test-hooks.test.ts`; `production-secrets.test.ts` |
| Configuration | 6 | 9.5 | `env-keys-consumed.test.ts` (every declared key read, every `AppConfig` leaf consumed); `env-confinement` with no entrypoint list; `no-tuning-literals.test.ts` |
| Lifecycle | 8 | 9.5 | `start-order.test.ts`; worker readiness probe; liveness without `\|\| exit 0` |
| Dependency injection | 7 | 9.5 | `no-module-state.test.ts`; widened `total-dependencies`; `getMetrics` gone |
| Boundaries & file discipline | 7.5 | 9.5 | `file-ceiling` covers specs, list deleted; `esm-specifiers` inverted; knip dependencies at zero |
| Errors | 7 | 9.5 | `no-discarded-result.test.ts` (type-aware); `catch-confinement` sees `.catch(`, list deleted; `error-vocabulary.test.ts` |
| Hygiene & single owners | 6 | 9.5 | `knip` at zero in `lint-typecheck`; `no-process-comments.test.ts`; single-owner assertions |
| Tests | 6 | 9.5 | correspondence list deleted; `spec-discipline.test.ts`; real `integration` job; 14 green nightlies |
| Observability | 5 | 9 | `promql-labels-emitted.test.ts`; API access log with redaction; exported API span; one `@vp/logger`, no `console`, `log-calls.test.ts` |
| CI speed | 5 | 9 | CI wall-clock budgets asserted from the run; docs-only PR skips the pipeline |
| Documentation | 6 | 9.5 | `doc-links.test.ts` (files **and** anchors); `doc-commands.test.ts`; `architecture-table.test.ts` |
| Drift | 7 | 9.5 | the three doc tests above, plus `gen-index.py` computing the frontier instead of storing it |

Targets are derived from the ACs, not claimed. If an AC is dropped in review, its row's target drops with it.

---

## What to build

Each workstream names the target design first and the ACs second. An AC is ticked only with pasted output.

Two shared mechanisms, both built in 88a and extended by every later PR:

- **`tests/architecture/zero-matches.test.ts`** - one `it.each` over `[name, pattern, scope, expected]`. An AC
  whose proof says *zero-matches row* is a row there, not a one-off grep, so it runs on every pipeline after the
  PR that ticks it. `scope` is a glob list over tracked files; production source means `apps`, `packages` and
  `scripts` without specs, `__tests__` and `__mocks__`.
- **`tests/architecture/entrypoints.ts`** - the one list of process entrypoints, read by `env-confinement`
  (W2 AC 3), `no-module-state` (W4 AC 2) and the `console` row (W9 AC 4). It holds `apps/api/src/main.ts`,
  `apps/api/src/migrate.ts`, `apps/worker/src/main.ts`, `apps/web/src/index.tsx`,
  `packages/server/db/src/bin/migrate.ts`, `packages/server/db/src/bin/seed.ts`, `scripts/*.ts`,
  `tests/e2e/e2e-runner.ts`, and one `src/main.ts` per CLI package. **The CLIs are renamed to that:**
  `compose-autoscaler/src/cli.ts`, `upload-client/src/cli.ts`, `dev-token/src/index.ts` and `gen-video/src/index.ts`
  become `src/main.ts`, and db's migrate and seed runners move out of the library modules into `src/bin/`. Beside
  it, `ENV_HOMES` names the non-entrypoint files allowed to touch `process.env`: `@vp/config`'s `load-env.ts`,
  `@vp/testing`'s `withEnv`, `apps/web/src/config/index.ts` and the `apps/web/src/Globals.d.ts` declaration.
  Together they cover the 15 files that read or declare it today, less the ones W2 moves behind `loadEnv()`.

### W1 - Security & authorization

**Problem.** A forgeable admin token (above), a verifier that checks no issuer or audience, a crash hook reachable
over HTTP, dev fixtures seeded into production, CORS reflecting any origin, and a production secret check that
only knows the string `change-me`.

**Target.**
- Token verification is a port, `TokenVerifier` in `@vp/core/ports`, returning `Result<Principal, AuthFailure>`.
  The JWKS adapter owns its key cache as instance state and is handed `issuer`, `audience`, `algorithms` and the
  JWKS URL by the composition root. The dev verifier is a second adapter, registered only when `auth.mode` is
  `dev`. `auth.mode` is a tagged union (`{ type: 'jwks', ... } | { type: 'dev', ... }`) resolved once in
  `toAppConfig`; `production` refuses `dev` at `loadEnv()`.
- The dev JWKS route is registered only in `dev` mode. Production has **no** static admin credential:
  `ADMIN_TOKEN` is refused under `production`, admin comes from a verified token's role claim. In `dev`, the admin
  token maps to a user that is provisioned like any other, so the hard-coded `…0003` id goes.
- The auth pre-handler replies with a problem itself instead of throwing, so `jwks-verifier.ts` and `auth.ts` leave
  `legacy-catch-sites.ts`.
- Fault injection moves out of production code and out of the wire contracts: `forceFailure`,
  `forceThumbnailFailure`, `simulateFailureRendition`, `testCrashAfterCommit` and the header are deleted; tests fail
  a stage by handing it a failing double of the port it calls.
- Migrations and seeding are two commands. The migrate Job migrates only.
- CORS reads `CORS_ORIGINS`; `production` refuses an empty or `*` list.
- The production secret check becomes a denylist of every credential this repo ships for local use (`vp`,
  `minioadmin`, `admin`, `change-me*`, and any of those as URL userinfo), applied to every secret-shaped key **and**
  every URL key.

**ACs**
1. Under `NODE_ENV=production`, `GET /.well-known/jwks.json` is 404, and a token minted by `pnpm dev-token mint --role admin` is 401 on `/admin/dlq`. Proof: `apps/api/src/__tests__/auth-hardening.test.ts`. **Done in 88a.**
2. A token with a valid signature and the wrong `iss`, the wrong `aud`, `alg: none`, an `alg` the JWK does not declare, or no `kid` while the JWKS holds two keys, is each 401. Proof: one `it.each` in the same suite. **Done in 88a.**
3. An ES256 token signed by a JWKS key verifies (today it always fails, `dsaEncoding` is missing). Proof: same suite. **Done in 88a.**
4. An unknown `kid` triggers one JWKS refetch, rate-limited to one per 30 s, and a rotated key is accepted without waiting for the TTL. Proof: adapter spec with a fake clock. **Done in 88a: `packages/server/adapters/auth/__tests__/jwks-token-verifier.test.ts`.**
5. `ADMIN_TOKEN` set under `production` fails `loadEnv()`. The string `000000000003` appears nowhere in production source. Proof: `load-env` spec; zero-matches row `000000000003` over production source, 0. **Done in 88a: `packages/server/config/src/__tests__/load-env.test.ts`, and the `000000000003` row.**
6. `forceFailure|forceThumbnailFailure|simulateFailure|testCrash|x-test-|killAtPercent` appear in no production source and no job-contract schema. Proof: `tests/architecture/no-test-hooks.test.ts`, with a fixture that fires. **Done in 88a.**
7. `apps/api/src/migrate.ts` migrates only; `pnpm db:seed` under `production` refuses. Proof: zero-matches row `@vp/db/seed` in `apps/api/src/migrate.ts`, 0; spec on `db/src/bin/seed.ts` refusing `production`. **Done in 88a, with the seed runner at `apps/api/src/seed.ts` (see *Decided in 88a*).**
8. `Origin: https://evil.example` gets no `access-control-allow-origin` when `CORS_ORIGINS=http://localhost:5173`. Proof: route spec. **Done in 88a: `apps/api/src/__tests__/app.test.ts`.**
9. `infra/k8s/base` under `production` fails `loadEnv()` until every secret is overridden, and the cloud overlay's rendered manifests (`kustomize build`) contain none of the denylisted values. Proof: `tests/architecture/production-secrets.test.ts` renders both with `kustomize build`. `lint-typecheck` installs a pinned kustomize, cached by version; the test fails, not skips, when the binary is missing. **Done in 88a.**
10. **Decided: `ExternalSecret`, not SOPS.** The repo then holds no ciphertext and no key to leak, and the rendered overlay can be asserted offline to carry no secret value at all; SOPS would need a real key in CI to prove the same. Local-first is unaffected: the operator is cloud-only like R2, and the local overlay keeps its dev secrets. The cloud overlay declares an `ExternalSecret` per secret-shaped key, and `secrets.enc.yaml` is deleted. Proof: `production-secrets` asserts the rendered cloud overlay contains no `Secret` with `data` or `stringData`, and one `ExternalSecret` entry per `SECRET_KEYS` member. **Done in 88a.**
11. The `videos` rate-limit admin exemption works (`skip` is not an option of `@fastify/rate-limit` 11; use `allowList`), `trustProxy` comes from config, and `bodyLimit` is set explicitly. Proof: route spec that the 6th reprocess request in a minute is 200 for an admin and 429 for a user (`max: 5`, `routes/videos.ts:95`). **Done in 88a: `apps/api/src/routes/__tests__/videos.test.ts`; `trustProxy` and `bodyLimit` in `app.test.ts`.**
12. The worker's R2 token grants what the worker does to each bucket and nothing more: it reads `raw` and deletes there (`expire-raw` and `purge-deleted` remove sources, `reconcile-uploads` aborts multipart uploads), and reads and writes `public`. The API's token reaches `raw` only. Proof: `packages/server/testing/src/__tests__/cloud-r2-tokens.test.ts` reads `main.tf` through `@cdktf/hcl2json` and holds each token's buckets and permission groups. **Done in 88f: the worker token read `raw` only, so every housekeeping delete there would have been refused in the cloud. R2 grants a delete only with Item Write, so the worker holds Read and Write on both buckets; the spec fails on the old `main.tf`.**

### W2 - Configuration

**Problem.** 25 of 68 declared keys reach no reader. `redis.pubsubUrl` is mapped and consumed by nothing,
`redis.password` reaches BullMQ but not the cache client, `worker.tmpDir` reaches housekeeping but not probe or
transcode. Tuning values are literals inside services, stages and adapters (17 non-identity `??` fallbacks, plus
default parameters and destructuring defaults), so the production value is whatever the default says. Migrate and seed read `process.env` directly, the composition roots default
config with `?? inProcessAppConfig()`, and three URL keys default to password-bearing values.

**Target.** Two schemas with named consumers. `AppEnv` is what `toAppConfig` reads, and every key in it reaches a
consumer. `PlatformEnv` is the short, explicit list of keys this repo hands to something else (`NODE_OPTIONS`,
`TURBO_TELEMETRY_DISABLED`, `DO_NOT_TRACK`, `OTEL_EXPORTER_OTLP_HEADERS`, `WORKER_RUNTIME`), each with the consumer
named beside it, so `env-key-closure` still closes. Every tuning value is an `AppConfig` field with its default
declared once, in the schema. Adapter selection is its own key, not `NODE_ENV === 'test'` (`app-config.ts:61`).

The unread keys get a decision each, recorded in the PR:

| Decision | Keys |
|---|---|
| Wire | `AUTH_ISSUER`, `AUTH_AUDIENCE` (W1), `CORS_ORIGINS` (W1), `BULLMQ_PREFIX` (replaces `'bull'` at two sites), `FFMPEG_PATH`, `FFPROBE_PATH`, `GOP_SECONDS`, `HLS_SEGMENT_SECONDS`, `S3_PART_SIZE_MIN_BYTES`, `S3_PART_SIZE_MAX_BYTES`, `MAX_DURATION_SEC` (as a probe rule in `@vp/domain-rules`; the `over-duration` fixture exists and nothing rejects it), `REDIS_PUBSUB_URL` |
| Move to `PlatformEnv` | `NODE_OPTIONS`, `TURBO_TELEMETRY_DISABLED`, `DO_NOT_TRACK`, `OTEL_EXPORTER_OTLP_HEADERS`, `WORKER_RUNTIME` |
| Wire or delete (decide, say why) | `ALLOWED_CONTENT_TYPES`, `AUTH_DEV_USER_ID`, `JOB_TIMEOUT_FACTOR`, `PUBLIC_API_URL`, `REDIS_ADDR`, `TRANSCODE_MODE`, `OTEL_SERVICE_NAME` |
| Delete (no feature reads it) | `WEBHOOK_SIGNING_SECRET` (and out of `SECRET_KEYS` - production refuses to boot without a secret nothing uses), `WEBHOOK_URL_ALLOWLIST` |

**ACs**
1. Every `AppEnv` key is read by `toAppConfig`, and every leaf of `AppConfig` is read by at least one production source outside `packages/server/env-schema`. Proof: `tests/architecture/env-keys-consumed.test.ts`, type-aware, with a fixture key that fires. **Done in 88a.**
2. Every `PlatformEnv` key names its consumer, and no key is in both schemas. Proof: same test. **Done in 88a.**
3. `env-confinement` reads `ENTRYPOINTS` and `ENV_HOMES` from `entrypoints.ts` and keeps no list of its own: `process.env` appears in those files and nowhere else, scanning `.ts`, `.tsx`, `.mts`, `.js` and `.mjs` under `apps`, `packages`, `scripts` and `tests`. Proof: the test, with a fixture read in a service and one in a `.mjs` file. **Done in 88a, CLIs renamed to `src/main.ts`; db has no `src/bin/` (see *Decided in 88a*).**
4. Migrate, seed and `drizzle.config.ts` go through `loadEnv()`. Proof: the same test, with the three files no longer special. **Done in 88a: migrate and seed go through `loadEnv()`; `drizzle.config.ts` reads no environment at all.**
5. No schema default and no production literal contains URL userinfo. Proof: `no-defaulted-secrets` widened to `://[^/@\s]*:[^@\s]+@` (the empty username in `redis://:vp@` is the case `+` would miss), with that URL as its fixture. **Done in 88a.**
6. `app.ts` and `runner.ts` require `config`; `inProcessAppConfig` is imported only by specs and `@vp/testing`. Proof: zero-matches row `?? inProcessAppConfig` over production source, 0; a `total-dependencies` fixture. **Done in 88a.**
7. No numeric default on a field of an options, deps or config object (`options.ttlMs ?? 3600`, `{ concurrency = 4 } = deps`) and no numeric default parameter in `apps/api/src/services`, `apps/worker/src`, `packages/server/adapters`. The identity fallbacks `?? 0` and `?? 1` are not tuning and are excluded. The audit's command finds 56 numeric `??` fallbacks there, 17 of them other than `0`/`1`; the destructuring and default-parameter shapes are counted by the test. Proof: `tests/architecture/no-tuning-literals.test.ts` (AST, not regex), a fixture per shape and one `viewsCount ?? 0` that must not fire. Named constants in `env-schema` are the only home. **Done in 88a.**
8. The worker's `workerId` is required in `StageDeps`; `worker-${process.pid}` appears once, in composition. Proof: zero-matches row `worker-${process.pid}` over production source, 1. **Done in 88a.**
9. `env-key-closure` reads every overlay, not only `infra/k8s/base`; `HOUSEKEEPING_INTERVAL_MS` in the cloud overlay is declared or removed. Proof: test, with an overlay fixture. **Done in 88a: `HOUSEKEEPING_INTERVAL_MS` removed.**
10. `MAX_DURATION_SEC=10` rejects the `l30` fixture at probe with a stable `ErrorCode`. Proof: stage spec. **Done in 88a against `s15` with `MAX_DURATION_SEC=10` (see *Decided in 88a*).**

**Decided in 88a.**
- The unread keys: `ALLOWED_CONTENT_TYPES` deleted (the list is a typed constant in `@vp/validation` the browser shares, and `CONTENT_TYPE_EXTENSIONS` must match it key for key, so it is a contract, not configuration); `AUTH_DEV_USER_ID` wired as the provisioned user the dev `ADMIN_TOKEN` acts as; `JOB_TIMEOUT_FACTOR` wired into the transcode hard timeout, which held the same `3` as a literal; `PUBLIC_API_URL` deleted (no server code builds an absolute URL); `REDIS_ADDR` moved to `PLATFORM_ENV` (read by the KEDA trigger, never by this code); `TRANSCODE_MODE` deleted (`combined` was never built); `OTEL_SERVICE_NAME` deleted with its manifest entries (both mains name their service in code). `CLOUDFLARE_TUNNEL_TOKEN` joins `PLATFORM_ENV`, because the overlays hand it to every pod through `vp-secrets`.
- `SECRET_KEYS` is what a production boot cannot start without and what the cloud `ExternalSecret` must supply: `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `REDIS_PASSWORD`. `ADMIN_TOKEN` is secret-shaped and refused in production, so it is not in it.
- New keys: `AUTH_MODE`, `AUTH_ALGORITHMS`, `ADAPTER_FAMILY` (the adapter switch, replacing `NODE_ENV === 'test'`), `TRUST_PROXY` (a list of proxy addresses; Fastify's types take no hop count) and `HTTP_BODY_LIMIT_BYTES`. `REDIS_URL` and `REDIS_PUBSUB_URL` default without userinfo; `REDIS_PASSWORD` now reaches the cache client too, and `DATABASE_URL_MIGRATIONS` falls back to `DATABASE_URL`.
- The seed and migrate runners live in `apps/api/src/`, not `packages/server/db/src/bin/`: going through `loadEnv()` means importing `@vp/config` (T4), which `@vp/db` (T2) cannot depend on. `pnpm db:migrate` and `pnpm db:seed` run them; `@vp/db` exports the library functions only.
- The duration limit stays in `@vp/ffmpeg`'s probe validation, which now takes `MAX_DURATION_SEC` instead of defaulting to 7200. Moving it into `@vp/domain-rules` means a relative `.js` specifier in a universal barrel until 88c inverts `esm-specifiers`; 88c can move it then. The proof uses `s15` with a 10 s limit, because `l30` is an `--include-slow` fixture CI never generates.
- The auth hook answers its 401 itself through `sendResult`, and Fastify's own 4xx errors now map to a problem with their status in `plugins/errors.ts`, which is what lets the body limit answer 413. W5 AC 8's route spec is still 88b's.
- Specs fail a transcode or thumbnail by spying the `@vp/ffmpeg` call (`apps/worker/src/__tests__/ffmpeg-failures.ts`), since the stages import FFmpeg directly rather than through a port; W4 is where it becomes a handed double. The upload client's crash-at-50% became an `AbortSignal` option.
- The cloud overlay handed `OTEL_EXPORTER_OTLP_ENDPOINT` and `_HEADERS` to every app pod through `vp-secrets`, where `envFrom` let the Grafana Cloud value override the ConfigMap's `http://alloy:4318`. Alloy now reads its upstream as `GRAFANA_OTLP_ENDPOINT` / `GRAFANA_OTLP_HEADERS`, and `production-secrets` asserts no cloud key is owned by both the ConfigMap and the `ExternalSecret`.
- `no-tuning-literals` also reads `@vp/ffmpeg` and module-level numeric constants. What they held is in `AppConfig` now (`tuning.ts`), and the S3 per-request key limit has one owner in `@vp/storage`. The master playlist omits `FRAME-RATE` instead of claiming 24 fps when the probe measured none.
- `tests/architecture/program.ts` is the shared `ts.Program` 88b asked for: `@vp/*` mapped to source so `lint-typecheck` needs no build, and only workspace modules and Fastify resolved, which keeps it under a second.

### W3 - Lifecycle

**Problem.** The worker consumes jobs before its metrics server and heartbeat exist, so a job can run with no
liveness signal, and a metrics bind failure calls `process.exit(1)` mid-job. Both mains install signal handlers
only after `main()` resolves, so a `SIGTERM` during start is a hard kill. Liveness treats a missing heartbeat as
healthy (`test -f … || exit 0`), and no worker has a readiness probe. The heartbeat write is copied into five
files, in two formats: `main.ts:22` writes epoch seconds, the four stage sites write `new Date().toISOString()`,
and the probe computes `$(( $(date +%s) - $(cat heartbeat) ))`. After a stage writes, the arithmetic is a syntax
error and liveness fails until the timer overwrites the file.

**Target.** Consumers are the last `Startable` in the container; metrics, heartbeat and readiness start first.
Handlers are installed before `container.start()`. One `Heartbeat` owner, one readiness check that asks the BullMQ
connection.

**ACs**
1. With a metrics port already bound, the worker exits non-zero **without having consumed a job**. Proof: `apps/worker/src/__tests__/main.test.ts`, asserting zero processed. **Done in 88b: the metrics server starts before the consumer, a bind failure fails `start()`, `run()` exits 1 and `InMemoryJobQueue#process` is never called.**
2. `SIGTERM` delivered during `container.start()` runs `shutdownOnce` and exits 0. Proof: main specs for both deployables. **Done in 88b: both mains take a `ProcessHost` and call `exitOnSignals` before `start()`; a dispose during start answers `interrupted`. `apps/{api,worker}/src/__tests__/main.test.ts`.**
3. `start-order.test.ts` (in `tests/in-process/` since 88d: it composes both apps, so it is an in-process spec rather than a static check) asserts, for both composition roots, that every consumer starts after metrics and heartbeat. Proof: architecture test over the registration order, with a fixture that fires. **Done in 88b: `tests/architecture/start-order.test.ts` composes both roots in-memory and reads `container.started()`.**
4. Worker liveness fails when the heartbeat file is missing or older than `3 x` its interval; every worker deployment has a readiness probe that fails when Redis is down. Proof: `k8s-manifests` spec; a toxiproxy chaos run named in the PR. **Done in 88b: liveness is `test -f ... && ... -lt 45`, readiness is `/readyz` on the metrics port; `k8s-manifests.test.ts` runs the liveness command against a fresh, a 45 s old and a missing file. The toxiproxy chaos run is not done here: it moves to 88d, beside W9 AC 10, which needs the same compose run with a dependency stopped.** **Done in 88d: `make chaos-readiness` (`scripts/chaos-readiness.sh`, `infra/compose/docker-compose.chaos.yml`) routes worker-notify's Redis through toxiproxy, disables the proxy and reads 503 from its `/readyz`, then 200 once it is restored; output in the PR.**
5. The heartbeat is written by one `Heartbeat` module, in one format: integer epoch seconds and a newline, which is what the probe's arithmetic reads. Proof: `Heartbeat` spec asserts the file matches `^\d+\n$` after every write path; zero-matches row `heartbeatPath` outside the `Heartbeat` module and composition, 0. **Done in 88b: `apps/worker/src/heartbeat.ts`, `heartbeat.test.ts`; the stages no longer write the file.**
6. A transcode whose step heartbeat returns `Err` (lost fencing) aborts FFmpeg and commits nothing. Today the `Result` is discarded (`transcode.ts:231`). Proof: stage spec. **Done in 88b: a lost lease aborts FFmpeg through an `AbortSignal` (`runFfmpeg` now takes one); `apps/worker/src/stages/__tests__/transcode.test.ts` for a refused renewal and a fenced step.**
7. Compose's API healthcheck uses `/readyz`; workers have a compose healthcheck. Proof: compose spec. **Done in 88b: `packages/server/testing/src/__tests__/compose-manifests.test.ts`.**

### W4 - Dependency injection

**Problem.** `getMetrics()` is a module-level singleton reached from 15 production files, because `StageDeps` has no
`metrics` field. Module state also lives in the JWKS cache, `tracing.ts`'s `sdkInstance`, `defaultPaginator`,
`defaultCursorCodec`, and an import-time `collectDefaultMetrics` in `plugins/metrics.ts` (a second metrics server
beside `@vp/observability`'s). Services construct collaborators (`new Singleflight()`, `new FastifyAdapter()`,
`new TranscodeProgressReporter`, `new StreamingSegmentUploader`), and `total-dependencies` cannot see default
parameters, destructuring defaults or `?? call()`.

**Target.** Metrics is a token. Stages receive it in `StageDeps`, adapters receive it from `registerAdapters`. A
collaborator a service needs per call arrives as a factory. Bull Board is built in the API composition module, and
the services directory imports no transport library. One metrics server.

**ACs**
1. `getMetrics` does not exist. Proof: zero-matches row `getMetrics` over `apps` and `packages`, 0. **Done in 88b: `Adapters.Metrics` is the registry; stages take it in `StageDeps`, storage is metered by `MeteredStorageClient` / `MeteredMultipartStorage`.**
2. No module-scope `let`/`var`, no module-scope `new` of a class with instance state, and no top-level call statement in any production module outside `ENTRYPOINTS` (`entrypoints.ts`), which is what lets `migrate.ts`, the CLIs and `apps/web/src/index.tsx` run. Proof: `tests/architecture/no-module-state.test.ts` (AST), fixtures for each of the three shapes. **Done in 88b: `defaultPaginator`, `defaultCursorCodec`, the tracing SDK, the import-time propagator and `time-ago`'s locale registration are gone.**
3. `total-dependencies` also fails on a default parameter or destructuring default whose value is a constructed object, a call, or a `default*` identifier, and it scans `app.ts`, `runner.ts` and `packages/server/adapters`. Proof: the widened test, with one fixture per shape. **Done in 88b.**
4. No `new` of a non-value class inside `apps/api/src/services` or `apps/worker/src/stages`. `Date`, `Map`, `Set`, `URL`, `Error` subclasses and `SseConnection` (a per-request value) are the only allowed constructions, listed in the test by name. Proof: `adapter-instantiation` widened. **Done in 88b, with `Promise` and `AbortController` on the list (see *Decided in 88b*).**
5. Bull Board is built in the API composition module. Proof: zero-matches row `@bull-board` over `apps/api/src/services`, 0. **Done in 88b: `apps/api/src/composition/bull-board.ts`.**
6. `startMetricsServer` exists once; `collectDefaultMetrics` is called once per process, with one prefix. Proof: zero-matches rows `function startMetricsServer` and `collectDefaultMetrics(` over production source, 1 each; a spec that the metrics endpoint has no duplicated `process_*` series. **Done in 88b, the first row as `class MetricsServer|function startMetricsServer` (see *Decided in 88b*).**

### W5 - Errors

**Problem.** ADR-24 says a failure is returned; nothing checks that a returned failure is looked at. The audit
counted about 36 statement-level discards. Four change behaviour: `expire-raw` records the event and counts the
video when the delete failed, `reconcile-uploads` counts a re-enqueue that failed, `purge-deleted` writes
`video.generation_purged` when every purge failed, and the transcode heartbeat (W3). `catch-confinement`'s regex
excludes `.catch(`, so 20 method catches in services and stages are invisible to it, two of them on a call that
returns a `Result` and never rejects. Error codes leak outside the vocabulary (`'ORPHANED'`, `'UNRECOVERABLE_ERROR'`,
`errorCode: string` in repository contracts), `transcode-failure.ts` classifies by message text, and FST 4xx errors
become 500.

**Target.** A discarded `Result` is a type error in spirit and an architecture failure in fact. A deliberate drop is
`ignore(result, reason)` from `@vp/result`, whose `reason` is a string literal the test reads. `ErrorCode` is the type
of every persisted error code. Fastify's own 4xx errors map to a problem with their status.

**ACs**
1. `ignore(result, reason)` exists in `@vp/result`, returns `void`, and requires a non-empty literal `reason`. Proof: `result` spec; a type test that `ignore(r, someVar)` fails to compile. **Done in 88b: `type-fixtures/ignore-reason.ts`.**
2. No expression statement anywhere in production source has type `Result` or `Promise<Result>` after unwrapping `await`, `void`, parentheses and `.catch/.finally`. Proof: `tests/architecture/no-discarded-result.test.ts` using the TypeScript checker, sharing one `ts.Program` with the other type-aware tests; fixtures for the bare, `void` and `.catch` shapes. **Done in 88b.**
3. `expire-raw` with a failing `deleteObject` writes no event and does not count the video; `reconcile-uploads` with a failing `add` does not increment `reconciler_repairs_total`; `purge-deleted` with every purge failing writes no `generation_purged`. Proof: one spec per stage, named after the stage. **Done in 88b: `stages/housekeeping/__tests__/{expire-raw,reconcile-uploads,purge-deleted}.test.ts`.**
4. `catch-confinement` matches `.catch(` and `?.catch?.(`; `legacy-catch-sites.ts` is deleted, and so is `shrinkOnly` in `repo-files.ts` once W6 and W8 delete theirs. Proof: the test, with a `.catch(() => {})` fixture in a service. **Done in 88b: homes are `@vp/result`, the adapters and `ENTRYPOINTS`; `legacy-catch-sites.ts` is deleted. `shrinkOnly` stays for the two lists W6 and W8 own.**
5. `no-domain-throw` also fails on `.parse(` of a zod schema inside its roots, and `validateJobId` returns a `Result`. Proof: fixture; zero-matches row `\.parse\(` over `apps/worker/src/stages` and `apps/api/src/services`, 0. **Done in 88b: payloads are parsed once at the registry edge, JSON through `parseJson` in `@vp/result`.**
6. Every persisted error code is typed `ErrorCode`: `step-repository`, `dlq-repository`, `probe-failure`, `failure-handler`. `ORPHANED` is added to the vocabulary with its SDD §6.2 line or replaced. Proof: `tests/architecture/error-vocabulary.test.ts` (no string literal assigned to a `code`/`errorCode` that is not an `ErrorCode`), and `error-code-drift` still green. **Done in 88b: `ORPHANED` is a pipeline code in SDD §6.2; the failure handler persists `errorCodeOf(err)`.**
7. No failure is classified by `message.includes`. Proof: zero-matches row `message\.includes` over production source, 0. **Done in 88b: a full disk is read from its errno; `pg-errors` reads the SQLSTATE only, which PGlite sets too.**
8. `POST /v1/uploads/:id/complete` with `content-type: application/json` and no body answers 400 problem+json; an unsupported media type answers 415. Proof: route spec, one `it.each`. **Done in 88b: `apps/api/src/routes/__tests__/uploads.test.ts`.**
9. `publishVideoEvent` returns a `Result`; `notify` and the progress reporter decide on it. Proof: `result-returning-ports` extended to `@vp/events`. **Done in 88b: notify retries a status it could not publish, the progress reporter drops a refused sample.**
10. No `as unknown as` in production source (14 today; `registry.ts:51` erases every stage's type). Proof: zero-matches row `as unknown as` over production source, web included, 0. **Done in 88b.**
11. No `'literal' in value` narrowing in production source, web included. Three cases, three answers:
    - **our own unions** carry one literal `type` discriminant and an exhaustive `switch` ending in `assertNever`: `package.ts`'s child results, `rules-to-sql.ts`, `failure-handler.ts`'s duck typing, `page-merge.ts`, `can.tsx`;
    - **RTK Query results** (`"data" in result`, `"status" in response.error` in `edit-page.tsx` and `video-settings-dropdown.tsx`) cannot carry a tag we own, so those call sites use `.unwrap()` inside `tryCatch` and get a `Result`;
    - **guards over `unknown`**, including `packages/universal/api-contracts/src/endpoint.ts:63-65`, parse through a zod schema instead of probing keys.

    Proof: `tests/architecture/no-in-probes.test.ts` (AST), no allowlist. **Done in 88b: `ChildResult` is a discriminated union in `@vp/job-contracts`, `Can` switches on `type`, RTK results go through `fromPromise(...unwrap())`.**

**Decided in 88b.**
- The container starts what it built in the order it built it, so each composition root resolves its probes first (`resolveBackground` in the API, `resolveStartOrder` in the worker) and `start-order.test.ts` holds the result. The API's HTTP listener opens after `start()`; a shutdown that lands before it skips the drain delay, since nothing is routing to it yet.
- The heartbeat is written by the `Heartbeat` timer only. The stages' ISO writes are gone rather than reformatted: the timer runs whenever the event loop does, which is what liveness is for. A first beat that cannot be written fails the boot.
- W4 AC 6's first row counts `class MetricsServer|function startMetricsServer`. The server is a class a composition root builds with the graph and `listen()`s in `start()`, so there is no free `startMetricsServer` left to count. Default process metrics carry the `vp_` prefix on every deployable.
- Storage metrics moved from a helper both adapters called into a decorator both families are wrapped in, and a call that returns `Err` now counts as an error (the helper counted any resolved promise as a success).
- W4 AC 4's list gains `Promise` and `AbortController`: both are per-call values like `Date`. The transcode's lease signal is an `AbortController`.
- `METRICS_PORT` and `PORT` accept `0`, and `inProcessAppConfig()` binds the metrics port to `0`, so two in-process apps never contend for one port.
- The failure handler persists `errorCodeOf(err)`: the error's own vocabulary code, or its cause's, else `INTERNAL`. `UNRECOVERABLE_ERROR` is gone; the DLQ copy still carries `unrecoverable`.
- `validateJobId` returns a `Result` and runs once, in `instrument()`, instead of first thing in five stages.
- The observability package moved from T1 to T2 to depend on `@vp/result`; the CLIs that now use `@vp/result` moved the same way.

### W6 - Boundaries & file discipline

**Problem.** The 400-line ceiling does not cover specs: 19 are over 400 lines, 24 over 10 KB, the largest 810. Five
production files are still on `oversized-sources.ts`. `packages/universal` and `packages/client` carry `.js` on
282 relative imports while every other tier is extensionless, enforced by `esm-specifiers.test.ts`. About 20
declared dependencies are never imported (`@vp/domain-rules`, `@vp/db`, `@vp/validation` in the worker;
`@fastify/jwt`, `@fastify/swagger-ui`, `@fastify/under-pressure` in the API; more in `db`, `upload-client`,
`adapters`, `apps/web`).

**Target.** One ceiling for every `.ts`/`.tsx` file the repo tracks. Relative imports are extensionless in every
tier, with no exceptions. A manifest declares what its source imports, and nothing else.

**ACs**
1. `file-ceiling` scans specs and `tests/`; no tracked `.ts`/`.tsx` file is over 400 lines or 10 KB; `oversized-sources.ts` is deleted. Proof: the test, with a spec-file fixture. **Done in 88c: `file-ceiling` reads every tracked `.ts`/`.tsx`/`.mts` file with a 401-line spec and a 10 KB fixture; the 25 files over it (23 specs and helpers, `postgres-video-repository.ts`, `schema.ts`) are split or trimmed, and `oversized-sources.ts` is deleted.**
2. No relative import in any tier carries a `.js`, `.mjs` or `.ts` extension. `esm-specifiers.test.ts` asserts the inverse of what it asserts today, over every tier, specs included. Proof: the test, with a `.js` fixture. [83 F](83-granular-container-topology-full-stack-deployment.md) is rewritten in the same direction: apps are bundled, nothing adds an extension. **Done in 88c: 325 `.js` specifiers removed from `packages/universal` and `packages/client` (specs included); `esm-specifiers.test.ts` fails on `.js`, `.mjs`, `.ts` or `.tsx` on any relative import, `vi.mock` included, over every tracked TypeScript file, with one fixture per extension. 83 §F already said bundle and stay extensionless.**
3. `apps/web` builds and its tests pass with extensionless `@vp/*` dist: CRA's webpack gets `resolve.fullySpecified: false` for the workspace packages through the smallest override that does it (craco is the expected one, as a devDependency). Proof: `pnpm --filter @vp/web build` green in CI; the override is the only webpack change. **Done in 88c: `apps/web/craco.config.js` adds one rule, `resolve.fullySpecified: false` for `.js` under `packages/`; `start`, `start-https` and `build` run `craco` (see *Decided in 88c* on dependency vs devDependency).**
4. `ARCHITECTURE.md` §5 tier section, `packages/universal/AGENTS.md`, `domain/`, `api-contracts/`, `pagination/` and `packages/client/AGENTS.md` say relative imports are extensionless everywhere. Proof: zero-matches row `\.js (extension|specifier)` over `ARCHITECTURE.md` and the `AGENTS.md` files under `packages/universal` and `packages/client`, 0. **Done in 88c: the row counts `.js extension|specifier` and `carry `.js``; `ARCHITECTURE.md` (§5 enforcement and the §6 table), `packages/universal`, `domain`, `api-contracts`, `pagination`, `packages/client` and `api-client` `AGENTS.md` say extensionless.**
5. Every declared dependency is imported by its package's source or config, and every import is declared. Proof: `knip` (W7) at zero for `dependencies`, `devDependencies` and `unlisted`. **Done in 88c: removed `@fastify/jwt`, `@fastify/swagger-ui`, `@fastify/under-pressure`, `prom-client`, dev `@electric-sql/pglite` (api); `@vp/db`, `@vp/domain-rules`, dev `@electric-sql/pglite` (worker); `@vp/domain-rules` (adapters); `@vp/errors`, `uuidv7` (db); `@vp/errors`, `@vp/storage`, dev `@vp/core` (upload-client); `lodash`, `react-bootstrap-icons`, `web-vitals`, `@testing-library/*`, `@types/lodash` (web); `@types/js-yaml` (root, testing). `fastify` is a root devDependency for `tests/e2e`; `@opentelemetry/context-async-hooks` is dev-only in observability.**
6. `pnpm boundaries` and `sdk-confinement` stay green with no new exception. **Done in 88c: both green; the new edges (`@vp/adapters` and `@vp/db` on T1/T2 packages, `@vp/ffmpeg` on `@vp/storage`) point down.**

### W7 - Hygiene & single owners

**Problem.** Repeated logic with no owner: `decidePartManifest` and `decideSizeMatch` re-implemented inline in
`upload-complete.ts` (the rules have zero importers), two `PROBLEM_CONTENT_TYPE`, `unavailable()` copied into 21
adapters, BullMQ `checkHealth` pasted twice, Redis keys in six files with `sse-hub` re-parsing channel strings, S3
keys hand-built in `purge-deleted`, `expire-raw` and `seed` because `keys.ts` has no prefix helpers, and the
rendition ladder defined four times (`CANONICAL_LADDER`, a dead `DEFAULT_LADDER`, `seed.ts:66`, and a hard-coded
`['1080p','720p','480p']` in `purge-deleted.ts:97`). 77 ticket/AC comments and 62 numbered-step comments in
production source. 54 values exported but used only in their own file, 34 exported and referenced nowhere, 135
used only by tests, about 280 barrel values with no outside importer. 64 biome warnings, 60 of them
`noExplicitAny`.

**Target.** Each concept has one owner and every other site imports it. `knip` is the unused-code gate and runs at
zero. Biome runs with warnings as errors.

**ACs**
1. `upload-complete.ts` calls `decidePartManifest` and `decideSizeMatch`; its inline copies and its `UploadPart` redeclaration are gone. Proof: zero-matches rows `decidePartManifest(` and `decideSizeMatch(` in `apps/api/src/services/upload-complete.ts`, 1 each; spec for the mismatch paths unchanged. **Done in 88c: the size mismatch hands the rule's failure to `rejectSizeMismatch`, and the multipart port takes `readonly` parts so the rule's output passes straight through.**
2. One `PROBLEM_CONTENT_TYPE`; one `unavailable` factory (`@vp/errors` `infra-failures`) and zero `private unavailable(` in adapters; one BullMQ health helper. Proof: zero-matches rows `PROBLEM_CONTENT_TYPE =` 1, `private unavailable\(` 0, BullMQ `async checkHealth` 1. **Done in 88c: `PROBLEM_CONTENT_TYPE` lives in `@vp/api-contracts` `problem.ts`; each infra factory carries `.during(operation)`, the `fromPromise` mapper the 21 adapter helpers (and the postgres client's module function) copied; rows `function unavailable` 1 and `private unavailable(` 0. The BullMQ row counts the health body, `status === 'ready'`, at 1 (see *Decided in 88c*).**
3. Every Redis key and channel is built by one module per family (`adapters/redis/keys.ts`, `@vp/events` channels); `sse-hub` parses channels through it. Proof: `tests/architecture/redis-keys-owner.test.ts` - a template literal starting `taitube:`, `video:` or `user:` outside the owners fails. **Done in 88c: `@vp/events` owns both families, `keys.ts` (`CacheKeys`) and `channels.ts` (with `channelType`, which `sse-hub` reads); the test (AST) also fails on a `taitube:` string constant and passes `'video:read'`.**
4. `keys.ts` exports the prefix helpers; no production source builds `raw/` or `videos/` by hand. Proof: zero-matches row for a template literal starting `raw/` or `videos/` over production source outside `storage/src/keys.ts`, 0. **Done in 88c: `rawPrefix`, `videoPrefix`, `reprocessPrefixesBefore` (never lists generation 1), `renditionPrefix`; `purge-deleted`, `expire-raw`, the seed and the fairness simulation build nothing by hand.**
5. One rendition ladder, in `@vp/job-contracts`; `DEFAULT_LADDER` is deleted; `purge-deleted` iterates `RENDITIONS`. Proof: zero-matches row `'1080p', '720p'` over production source, 0. **Done in 88c: `@vp/job-contracts` `ladder.ts` owns `RENDITIONS`, `LadderEntry` and `CANONICAL_LADDER`, which `satisfies readonly LadderEntry[]`; `DEFAULT_LADDER` and `FfmpegLadderSpec` are deleted (row `DEFAULT_LADDER` 0); `purge-deleted` iterates `RENDITIONS` and the seed reads the ladder. The row counts the one literal list, `RENDITIONS` itself, at 1 (see *Decided in 88c*).**
6. Zero ticket, AC, `Step N` and numbered-step comments in production source **and** specs, including test titles (141 `it`/`describe` titles start with `AC N`). Proof: `tests/architecture/no-process-comments.test.ts` with the regexes from the audit, no allowlist. `ADR-NN` and `SDD §` references stay allowed: they point at a durable decision, not a work item. **Done in 88c: the test parses every tracked TypeScript and JS file under `apps`, `packages`, `scripts` and `tests` and reads comments and `it`/`test`/`describe` titles (`.each` included) for `AC`, `ticket`, a workstream `W7`, `#NNN`, `Step N` and a numbered step; ten fixtures fire, five do not (ADR, SDD §, a string, a hex colour, a plain title). 369 references removed.**
7. `pnpm knip` runs in `lint-typecheck` twice and both runs report zero: the default run (unused files, exports, types, dependencies, unlisted imports) and `knip --production`, which is the mode that reports the 135 exports only specs use. `knip.json` sets `includeEntryExports: true`, without which the ~468 barrel exports nobody imports are never reported. No ignore list beyond generated files and tool configs. Proof: CI step output of both runs. **Done in 88c: `pnpm knip` and `pnpm knip --production` are two steps in `lint-typecheck`, both exit 0 with no issue. `knip.json` declares entries and production projects per workspace and ignores nothing but four OS binaries (see *Decided in 88c*). About 170 exports and types went: unused ones deleted, file-local ones unexported, and test-only ones either tested through the public function or moved into a module production imports, each with its spec.**
8. `biome lint --error-on-warnings` exits 0 and `noExplicitAny` is `error`. Proof: CI step output. **Done in 88c: 66 warnings to 0 (60 `noExplicitAny` typed, 6 `useSimplifiedLogicExpression` applied); every rule that was `warn` is `error`, and `pnpm lint` is `biome lint --error-on-warnings .`.**
9. `apps/worker/src/__mocks__/job.mock.ts` (0 importers) and every other file knip reports is deleted, not suppressed. Proof: knip. **Done in 88c: `job.mock.ts`, `apps/web/src/hooks/index.ts`, three unreferenced `*.module.scss`, the `@vp/config` loader module, and the dead permission helpers and normalizers (`can`, analytics, comments, channel and comment subjects) and validation adapter are deleted; the type fixtures are knip entries and export nothing.**

**Decided in 88c.**
- Cache keys live in `@vp/events` (`keys.ts`) beside the channels, not in `adapters/redis/keys.ts`: the feed service caches pages through the generic `CacheClient` port and may not import `@vp/adapters`, and `@vp/events` is the one server package both the adapters and the services already read Redis vocabulary from. One package owns both families, one module each.
- The BullMQ health row counts the body (`status === 'ready'`) rather than `async checkHealth`: `BullMqJobQueue` and `BullMqFlowProducer` each extend their own port and must each implement the method, so two one-line delegations to `checkBackendHealth` is the single owner.
- `zero-matches`' directory rows read nothing before this PR: git drops every file when an exclusion does not share the include's prefix, so `@bull-board` in services and `.parse(` in stages and services were counted over zero files. `productionUnder` prefixes its exclusions, and a row per scope asserts it reads at least one file.
- `@craco/craco` is a dependency beside `react-scripts`, not a devDependency: `knip --production` treats `start` and `build` as the app's runtime, and CRA's build tool is already a dependency for the same reason. The override is still the only webpack change.
- `knip.json` ignores three binaries (`ffmpeg`, `ffprobe`, `kustomize`; `kubectl` went once the k8s specs rendered with `kustomize` in 88e): they come from the OS image and CI's setup steps, no manifest can declare them. The k6 scripts in `tests/load` are outside the root project because k6 runs them, not Node, and `import 'k6'` is not a package. `scripts/*.ts` are non-production entries (developer and CI tools, never shipped), and `@vp/testing` checks no entry exports: every consumer of a test package is a spec, so `--production` would report all of it by definition. Everything else is an entry or a production project; nothing is ignored.
- The rendition names are a literal tuple and the ladder is typed against it (Mateusz picked this shape over deriving the names from the ladder, which needed a cast for `z.enum`). So the `'1080p', '720p'` row counts that one list at 1 instead of 0.
- Mains are thin: `apps/{api,worker}/src/main.ts` read `process.env` and call `run(host)` in `process.ts` (the API's drain lives in `serve.ts`), and each CLI's logic is `run(host)` in `src/cli.ts`, with `main.ts` owning the one catch and the exit code. That is what lets the specs drive them without importing an entrypoint's exports. The CLIs stay dependency-free (T1) so they still run from source before a build.
- `platform-env.json` replaces `platform-env.ts`: nothing of ours reads those keys at runtime, so they are data, read by `env-key-closure`, `env-keys-consumed` and the env-schema specs. `SECRET_KEYS` is its own module, which `app-env.ts` imports.
- The Node resolve hook is a synchronous `module.registerHooks` in `register.js`, so `loader.mjs` and its `./loader` export are gone.
- `sprite-vtt` parsing is gone rather than moved: the VTT is our own writer's output, so specs assert on its text.
- The `parseRouteTree` helper in `contract-drift.test.ts` still reads `printRoutes()` with regexes. It predates 88c and nothing here moved it; it is left for W8.
- `esm-specifiers` reads TypeScript only: the k6 scripts need their `./common.js` extension, because k6 does not resolve one.
- The duration limit stays in `@vp/ffmpeg`'s probe validation. The `.js` blocker is gone, but it sits there with the other two probe rules (no video stream, codec allowlist), and moving one of the three into `@vp/domain-rules` splits the probe's rules across two packages for no caller that needs it.
- `routes-outside-send-result.ts` was already empty and is deleted with `oversized-sources.ts`; `shrinkOnly` stays for `untested-sources.ts` alone, which W8 owns. Twelve of its entries were paid by the spec splits.
- `schema.ts` came under the ceiling by deleting its 22 inferred `$inferSelect`/`$inferInsert` exports, which nothing imported, and its banners; `postgres-video-repository.ts` by moving the scan filter to `video-scan-query.ts` (with its spec) and letting the column defaults fill `create`.

### W8 - Tests

**Problem.** 130 sources have no spec, 53 of them `apps/web`. 12 specs cover a listed source under the wrong name or
directory. 54 specs import vitest globals, 22 sleep for a fixed time, two assert wall-clock elapsed time, only one
file uses fake timers although the standard mandates them, 14 files spy without restoring, and fixtures are copied
(`createMockJob` 3x beside an unused shared one, `setupUploadedVideo` 4x, `freePort` 2x with a check-then-use race,
the same UUID literal 44x). `test:bun` skips `apps/api` entirely. The integration job runs unit tests twice. One
Bun-only flake is on record (`redis-reaction-cache.adapter.test.ts` patches `Math.random` and waits 20 ms).

**Target.**
- **The contract suites are the per-file specs.** Each repository's contract is exported from `@vp/testing`
  (`videoRepositoryContract(subject)`), and each repository file gets its own spec that runs it:
  `in-memory-video-repository.test.ts` runs it against the double, `postgres-video-repository.test.ts` against
  PGlite in `unit` and against real Postgres in `integration`. That pays 30 list entries with real coverage, keeps
  rule 12 honest, and dissolves the bundled `repositories.contract.test.ts`. Redis, S3 and BullMQ adapters get the
  same shape against the doubles and against real Redis and MinIO.
- `integration` means real services: Postgres, Redis and MinIO service containers, URLs through `loadEnv()`.
- Time in specs is injected. A stage or adapter that waits takes a clock or a scheduler; specs drive it.
- `apps/web`'s 53 sources get specs against its existing Vitest + Testing Library setup. Waiting on 53-55 is not a
  plan: they sit behind about twenty blocked tickets. A component that is dead is deleted instead.

**ACs**
1. `untested-sources.ts` is deleted and `test-correspondence` is a flat assertion over every tier, `apps/web` included. Proof: the test; zero-matches row for the path `tests/architecture/untested-sources.ts`, 0 files. **Done in 88e: 106 entries at the start of the PR (130 at the audit), 0 now, and the file is gone with `shrinkOnly`. The web app's 52 sources, the 30 adapter doubles and repositories, the scripts, db, core, dev-token, gen-video and the rest each have their spec; `test-correspondence` reads a module with its comments removed, so a documented abstract port asks for none. The zero-matches row counts `untested-sources|UNTESTED_SOURCES|shrinkOnly` over `tests/architecture` at 0.**
2. Every repository and cache contract runs from the per-file spec of each implementation; `repositories.contract.test.ts` is gone. A deliberately drifted double (off-by-one in the feed rank) fails both the double's spec and the Postgres spec. Proof: fixture run pasted in the PR. **Done in 88e: `repositories.contract.test.ts` is gone; each of the 12 in-memory and 12 Postgres repository files has a spec that runs its `describeXRepositoryContract`, and the cache client, category cache, subscription cache, storage, multipart, job queue and flow producer ports have contracts run from each double's spec and each real adapter's. The drifted-rank fixture (`rankOf(cursor, nowMs) + 1` in the in-memory `public-feed-query.ts`) fails six keyset tests in `in-memory-video-repository.test.ts`; the Postgres spec stays green with it, because nothing of the double reaches Postgres. The same off-by-one on the Postgres cursor (`viewsCount + 1` in `cursorRankInput`) fails four in `postgres-video-repository.test.ts`, so the one shared assertion in `video-feed.contract.ts` catches the drift on either side (output in the PR). The contracts found six defects the specs had hidden (see *Decided in 88e*).**
3. `in-memory-flow-producer.ts` has no `instanceof InMemoryJobQueue`; a flow whose parent queue is not in-memory returns `Err` instead of never running. Proof: spec (carried from the previous 88). **Done in 88e: the producer takes a queue lookup; a flow naming a queue it cannot run (parent or child) returns `Err(QUEUE_UNAVAILABLE)` before enqueuing anything. `in-memory/__tests__/in-memory-flow-producer.test.ts`.**
4. The `integration` job starts Postgres, Redis and MinIO, and the Postgres, Redis, S3 and BullMQ contract specs run against them. A spec there that silently falls back to PGlite or an in-memory double fails. Proof: CI log shows the service containers and the suite count; `test:integration` differs from `test`. **Done in 88e: `tests/integration/vitest.config.ts` runs the 12 Postgres repository specs and the Redis, S3 and BullMQ adapter specs against the Compose services, URLs through `loadEnv()`; `use-real-services.ts` fails a file in which no contract claimed a real service, and an unreachable service fails its file. `test:integration` is `turbo run test:integration && vitest run --config tests/integration/vitest.config.ts`; the duplicate `vitest run` scripts in `apps/api` and `db` are gone. The job prints the service containers; 17 files, 149 tests locally (CI log in the PR).**
5. `tests/architecture/spec-discipline.test.ts` fails on any of these in a spec, each with a fixture: **Done in 88e: every rule has a fixture that fires and the not-a-violation cases have their own. At the start of the PR: 8 runtime vitest imports (54 at the audit), 20 timer waits and 2 sleep helpers, 4 elapsed-time reads in specs (the api upload latency, two in the fairness spec, the outbox relay), 9 repeated titles, 0 `console`, 1 `skipIf`. All 0. A repeated title is a repeated full title (describe path plus the test's own), which is what a reporter prints. The e2e runners are outside its scope (see *Decided in 88e*).**
   - a runtime import from `vitest` (type-only imports allowed) - 54 today;
   - `setTimeout` inside a `new Promise`, `setImmediate` as a wait, or a helper named `sleep`/`settle`/`delay` - 22 today;
   - an assertion on `Date.now()` or `performance.now()` elapsed time - 2 today;
   - `typeof import(` or `importOriginal<` - 0 today, kept at 0;
   - two `it` titles identical within one file - the audit lists 10 clusters;
   - `console.log` - 7 today;
   - `.skip`, `.only`, `.todo`, `skipIf`, `runIf` - 1 today (the R2 suite becomes an opt-in `make` target, not a skip).
6. The shared vitest config sets `restoreMocks: true` and `unstubEnvs: true`. Proof: config spec in `@vp/testing`. **Done in 88e: `definePackageTestConfig` and the configs that do not use it (web, result, scripts, in-process, both architecture configs) set both; `@vp/testing`'s `index.test.ts` imports every project config the root runs and holds each to it. Bun preloads `tests/bun-restore-mocks.ts`. Manual `restoreAllMocks` hooks are gone from the specs touched.**
7. `createMockJob`, `setupUploadedVideo`, a `buildTestApp`, and the seeded user, channel and video ids live in `@vp/testing` and are imported; the local copies are gone; `freePort` is replaced by `listen({ port: 0 })`. Proof: zero-matches rows `function (createMockJob|setupUploadedVideo|freePort)` over `apps` and `packages` outside `@vp/testing`, 0, and `00000000-0000-7000-8000-000000000001` over specs, 0. **Done in 88e: `@vp/testing` owns `SEEDED`, `createMockJob` and `withEnv`; `buildTestApp` is in `apps/api/src/__tests__/test-app.ts` (see *Decided in 88e*) and about 40 api specs build on it. `freePort` is gone: the process spec binds port 0 and spies `http.Server.prototype.listen`. Rows `function (createMockJob|uploadedVideo|freePort)` over TypeScript in `apps` and `packages` outside `@vp/testing`, 1 (the worker harness's `uploadedVideo`, which the probe spec imports instead of its own copy), and the seeded id over specs, 0.**
8. The five named `it.each` folds land (subscriptions-routes' five 401s, admin-dlq-and-reprocess' duplicated 403/404 pairs, `api.test.ts` healthz/livez against `health.test.ts`, the upload ownership refusal repeated across five service specs, the reaction adapter and its store asserting the same three cases). Proof: the duplicate-title check in AC 5 green. **Done in 88e: the upload ownership refusal is one `it.each` over abort, complete, resume and sign parts in `upload-service.test.ts`; `api.test.ts` leaves liveness, readiness and the dev JWKS to their route specs; admin-dlq's status tests and housekeeping's scheduler tests are one `it.each` each; the reaction store spec owns read, absent, adjust and invalidate for both backends and the adapter spec keeps what it adds. subscriptions-routes' 401s were already one `it.each`.**
9. `pnpm test:bun` covers `apps/api` as well as `apps/worker` and `packages`, and stays green 20 runs in a row under `--rerun-each 20` for the two known timing suites. Proof: CI log. **Done in 88e: `test:bun` is `bun test --timeout 30000 apps/api apps/worker packages`; no source change was needed, every Bun gap was in a spec (no `vi.setSystemTime`, `vi.mock(import(...))`, `vi.stubEnv`, `getActiveResourcesInfo`). `unit-bun` runs `segment-uploader` and `redis-reaction-cache.adapter` with `--rerun-each 20`; the whole api ran 20 times locally, 13480 pass.**
10. The 12 misnamed or misplaced specs are renamed or moved to the name rule 12 expects. Proof: `test-correspondence` green with no list. **Done in 88e: progress-reporter (worker `__tests__` to `stages/__tests__`), `assertCan` to `assert-can`, dev-token into `jwt` and `keys`, `upload-client` to `client`, `metrics-catalogue` to `metrics`, the two db schema specs into `schema`, `gen-video.test.ts` into `generator`, `probe`, `generate-fixture` and `check-fixture`, the four `smoke.test.ts` to `index.test.ts`, and the api's `channels-repository` and `categories-repository-and-cache` into the adapter specs.**
11. The nightly load smoke is green for 14 consecutive nights before the ticket closes, and the PR names the root cause of the three 100% `http_req_failed` nights. The `presign` threshold is measured against a baseline recorded on the same runner class, not a fixed 200 ms. Proof: `gh run list --workflow load-smoke.yml` pasted. **Done in 88e, apart from the 14 nights: the ticket closed without them. Root cause of the three 100% nights (09-19 35428692251, 09-20 35497372031, 09-21 35574829996, all on main): the workflow minted its token with `TOKEN=$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint || echo <token>)`. At 32c45fc4 and 945927a0 the root had no `tsx` (and `tools/dev-token/src/cli.ts` did not exist either), and pnpm prints `Command "tsx" not found` to stdout, not stderr, so `$(...)` captured `undefined`, the pnpm error and the fallback token, one per line. The newline in the `Authorization` value is what Go's `net/http` refuses (`invalid header field value for "Authorization"`), so every request failed in k6 before it left the runner. Reproduced locally: `T=$(pnpm -w exec tsxx x mint 2>/dev/null || echo FALLBACK)` gives `undefined\n ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "tsxx" not found...\nFALLBACK`. 52d209eb (#97) had already replaced it with a pre-baked token in the step's `env`, which is why 09-23 (35832561831) was green. The two later failures (09-22 35700168834, 09-24 35969761715) were the fixed `p(95)<200` on slow runners that were slow for everything (complete p95 255 ms, 170 iterations against 250 on a normal night). The bar is now measured on the same runner: a one-VU baseline step records presign p95 and p99, and the run is held to six times each (36043095164: baseline p95 19.6 / p99 32.5 ms, bar 118 / 196 ms; 36044531410: baseline p95 23.4 / p99 33.6 ms, bar 141 / 202 ms, measured p95 50.3 / p99 81.8 ms; a baseline that records no p95 or p99 fails the step, which is what 92bdec89 needed). The nightly runs on `main`, so the 14 nights could only start counting once this merged.**
12. `docs/standards/testing.md` records the contract-per-file pattern, the injected-clock rule, and that the integration job runs against real services; its fake-timers line matches what the specs do. **Done in 88e.**

**Decided in 88e.**
- The contracts stay in `@vp/adapters` (`__tests__/contract/`), not `@vp/testing`: `@vp/testing` depending on `@vp/core` makes a workspace cycle, since every package dev-depends on `@vp/testing`. `buildTestApp` is in `apps/api` for the same reason (it needs `composeApp`), and so is the worker harness. `@vp/testing` holds what needs no layer above it: `SEEDED`, `createMockJob`, `withEnv`, the config factory.
- Each Postgres spec file gets its own PGlite, loaded from one migrated snapshot the adapters project builds in its global setup: a fresh PGlite runs initdb, most of a second, the snapshot loads in about a tenth. An earlier version shared one engine across the 12 specs on an unisolated thread; that is gone.
- `runMigrations` and `seedDatabase` open their own `postgres` client, so their specs reach PGlite through `@electric-sql/pglite-socket` (a dev dependency of `@vp/db`). The migrations hash moved to `migrations-hash.ts`, which `runMigrations` imports, instead of an export only the spec read. Its migrations folder is the package's own `../drizzle`, which the bundle copies.
- The contracts found against real Postgres and BullMQ what PGlite and the doubles accepted: postgres-js cannot bind a `Date` in a raw `sql` fragment (the trending feed, every feed cursor, the housekeeping scans), BullMQ's `Worker` rejects options passed as `undefined`, `getJobSchedulers()` reported the template name as the id, the step repository wrote a `completedAt` key that does not exist so `finished_at` was never set, and the multipart double listed parts in insertion order. All fixed, each with a contract assertion.
- The video scan limit is `housekeeping.scanLimit` in `AppConfig`, handed to every sweep; `DEFAULT_VIDEO_SCAN_LIMIT` in `@vp/core` defaulted it inside both repositories. The segment uploader's poll interval is `segmentUpload.pollIntervalMs`.
- Time: the outbox relay and the segment uploader take `every: Every`, the scheduler `Heartbeat` already took, and the progress reporter a `now`. Specs drive them by hand. Bun's `vi` has no `setSystemTime`, so a spec that runs under both runtimes injects the clock.
- `spec-discipline` reads specs, `__tests__` helpers, `tests/architecture`, `tests/in-process` and the e2e specs, not the e2e runners: those poll a deployed stack on its own clock, and a sleep between polls there is the protocol, not a shortcut.
- `pnpm e2e` starts `tests/e2e/run-e2e.ts`, beside the `e2e-runner.ts` it drives (and which was already an entrypoint), instead of `scripts/`. `bad-codec.mov` is Motion JPEG in QuickTime, generated by `gen-video`, and `tests/in-process/e2e-fixtures.test.ts` fails when an e2e spec reads a fixture a plain `pnpm gen-video` does not make. `E2E_REDUCED=true pnpm e2e` passes locally.
- The web specs render with `renderToStaticMarkup` in the node environment, no jsdom and no Testing Library, so they cover render output only. Not covered, because each needs a client render, an effect or a click: the edit page's submit and its 409 toast, delete in `video-settings-dropdown`, the subscribe and unsubscribe clicks, `setReaction`, the observer in `is-visible-container`, and `useDrag` moving. `stored-value.ts`, `browser.ts` and the `Object.assign` probe components exist only because of that, and go when a client render does. Adding jsdom and Testing Library is left to the frontend tickets (49-75), which replace these components anyway. The RTK Query slices are what components call their hooks on, so specs dispatch the endpoints without a test-only export. They found `PermissionsProvider` reading a `role` the `Account` contract does not carry, so every signed-in user is a guest to the rules; it is not fixed here (no AC names it) and the specs pass a viewer explicitly.
- Behaviour no AC names, changed because a spec could not be written honestly otherwise: the sidebar's subscriptions header shows the total count and offers "show more" past five (it counted the list after cutting it to five, so "show more" never appeared); `OutboxRelay` drains on start and then on a fixed-rate `every` tick, and its first drain's promise is what a spec awaits (it used its own `setTimeout` loop); the tracing SDK moved to the `@vp/observability/tracing-sdk` subpath (below); `MetricsServer` is unchanged. A defect found and left alone: `runReconcileUploads` does not count what it just enqueued against the owner's in-flight limit, so one pass can admit more than `maxInflightPerUser`.
- The two caches got contracts and each one found a drift. The Redis category cache sorted what the fetcher returned, the double did not; it no longer sorts, since the category repository orders the list and its contract asserts it (and `localeCompare` could disagree with Postgres' collation). Redis drops a set when its last member goes, so unsubscribing from the only channel leaves a miss, not a primed empty set; the double does the same now and the service re-primes on the next read. `FakeRedis.srem` drops an emptied set too, so the unit run sees what Redis does.
- `unit` does not isolate spec files: `isolate: false` in the root `vitest.config.ts`, so the files of one project share a worker and its module cache. That is what took `unit` from 152751 ms (36044531736) to 56946 ms (36102141367). What it needed in the web specs: the `useLocalStorage` mock outlives the file that registered it, so `stored-value.ts` keeps one store per worker; `App` takes its router from `index.tsx`, so `App.test.tsx` wraps it in a `MemoryRouter` instead of mocking `react-router-dom`; the entrypoint spec loads `App` before it stubs `document`, because emotion decides on load whether it runs in a browser; and the web deps are no longer pre-bundled, which mixed two React instances once the cache was shared. `docs/standards/testing.md` records the rule. Found and left alone: `subscriptions-routes`, `video-reactions-routes` and `video-reprocess` chain state from one test to the next inside the file, so they fail under `--sequence.shuffle.tests`. They fail the same way on main before 88e, so it is older than this PR.
- `test:architecture` hands `matchesGlob` only the files under a glob's literal directory with its literal ending, and `esm-specifiers` skips a file that quotes no relative path with an extension (the same change as 88f's, kept identical so the two rebase cleanly).
- Speed, what moved `unit` before that: the tracing SDK (NodeSDK and every auto-instrumentation) is `@vp/observability/tracing-sdk`, imported by the two preloads alone, instead of loading with every helper the barrel exported; the k8s specs render with `kustomize build` instead of `kubectl kustomize` (3-4 s per overlay on the runner); the api project pre-bundles its heavy dependencies; one test app per api spec file instead of one per test.

### W9 - Observability

**Problem.** The API has no logger. The worker logs through pino with no redaction and no request id, and one
reconciler hard-codes a `traceparent`, so every reconciled upload shares one trace. Auto-instrumentation is
initialised inside `main()`, after the static imports it has to patch, so the Fastify, pg and ioredis spans are
probably never produced and the worker's parent span comes from a random id. Three metric defects break alerting and
scaling (above), 404s put the raw URL into the `route` label, and `time_to_ready_seconds` measures from creation, not
from upload complete. Outside the two deployables nothing logs through a logger at all: about 54 `console` calls in
`scripts/`, 46 in the CLIs and db runners, 10 in the apps' entrypoints and 7 in `tests/e2e`, with seven hand-rolled
`err instanceof Error ? err.message : err` ternaries turning errors into text.

**Target.** One `createLogger` for both deployables, redacting `authorization`, `cookie` and `x-admin-token`,
carrying a request id taken from `x-request-id` or generated, and propagating it into job payloads beside
`traceparent`. Tracing is preloaded through `--import`. Every label value a query depends on is emitted, and a test
says so. Logging has one package, `@vp/logger`, used by everything that runs: `json` for the deployables, `pretty`
(a readable line on stderr) for the CLIs, scripts and the e2e runner. Errors are a field, serialized in one place, and
messages are fixed strings with the variable parts in fields.

**ACs**
1. The API logs one structured line per request with method, route, status, duration and request id; an `Authorization` header never appears in a log line. Proof: spec capturing the log stream. **Done in 88d: `createLogger` is the API's `loggerInstance`; `plugins/access-log.ts` writes one `request completed` line; `plugins/__tests__/access-log.test.ts` reads the stream and finds no `secret-token`.**
2. An unhandled error in a route produces one `error` log line with the request id, and a problem response. Proof: spec. **Done in 88d: same spec, a route that throws.**
3. The request id of `POST /v1/uploads/:id/complete` appears in the probe job's log lines. Proof: in-process e2e spec. **Done in 88d: `tests/in-process/request-correlation.test.ts` runs the API and a probe worker over one in-memory queue; `requestId` is in the job payload and on every probe line through `LogContext`.**
4. No `console.*` in production source outside `ENTRYPOINTS`. Proof: zero-matches row `console\.` over production source minus `entrypoints.ts`, 0. **Done in 88d: `loadEnv` throws its message, the db migrate/seed helpers and gen-video's generator take a `log` from their entrypoint; the row is in `zero-matches.test.ts`, and the mains log through the logger.**
5. Every label value used in `infra/observability/**`, `infra/k8s/base/scaled-objects.yaml` and alert rules is emitted by some code path: `state="prioritized"` is polled, `result="stalled"` is recorded from the BullMQ `stalled` event. Proof: `tests/architecture/promql-labels-emitted.test.ts`, with a fixture query that fires. **Done in 88d: the poller reads `QUEUE_JOB_STATES` (with `prioritized`), the consumer counts `result="stalled"` from the port's `onStalled`; `promql-labels-emitted.test.ts` reads label values through the type checker. It also found `ScaleToZeroBroken` and the replicas panel selecting `deployment=~"worker-.*"`, which matches no Deployment (they are `vp-worker-*`).**
6. Workers do not write `bullmq_queue_jobs`; after one job and an idle period, the KEDA trigger query returns 0 for that queue. Proof: spec on the stage metrics plus the k3d run named in the PR. **Done in 88d: `stages.module.test.ts` finds no `bullmq_queue_jobs` sample after a job. On k3d, one prioritized notify job took the trigger query to 1 and `vp-worker-notify` from 0 to 1 pod; the query read 0 thirty seconds later and the deployment was back at 0 after the 300 s cooldown; only `vp-api` exports the gauge. Output in the PR.**
7. A 404 records `route="unmatched"`. Proof: `http-metrics` spec. **Done in 88d: `routeLabel` is shared by metrics, the access log and the span; `plugins/__tests__/http-metrics.test.ts`.**
8. Running the API with the collector exporter captured in-process, one request yields an HTTP server span whose trace id matches the `traceparent` on the job it enqueued. Proof: spec. `reconcile-uploads` creates a new root trace per repair instead of a constant. **Done in 88d: `plugins/__tests__/request-span.test.ts` (also under a suppressed context, which is how the HTTP instrumentation hands the request over); `apps/*/src/instrument.ts` preloads the SDK; `rootTraceparent` gives each repair its own trace (`reconcile-uploads.test.ts`). A Tempo trace from the compose stack is in the PR.**
9. `time_to_ready_seconds` measures from upload complete, as §13.1 says. Proof: stage spec with an injected clock. **Done in 88d: `package.ts` reads `uploads.completed_at` and a `now` from `StageDeps`; `stages/__tests__/package.test.ts`.**
10. S3 `checkHealth` issues a `HeadBucket`; `/readyz` answers 503 when MinIO is stopped. Proof: adapter spec with a failing fake client; chaos run. The same compose run carries W3 AC 4's toxiproxy proof: a worker's `/readyz` answers 503 while Redis is cut off. **Done in 88d: both S3 adapters answer readiness with `HeadBucket` on the raw bucket; adapter specs over the fake client; `make chaos-readiness` reads 503 from the API with MinIO stopped.**
11. The `neon_compute_hours_used` panel and its `vector(12.5)` fallback are removed or fed by a real exporter. Proof: dashboard spec. **Done in 88d: removed; `packages/server/testing/src/__tests__/dashboards.test.ts` holds it out and holds the k8s ConfigMaps equal to the dashboard files, which had drifted.**
12. One logging package, `@vp/logger` (`packages/server/logger`), owns `createLogger` and the `Logger` type. `@vp/observability` re-exports nothing about logging, and no other package imports `pino`. Proof: zero-matches rows `from 'pino'` outside `packages/server/logger`, 0, and `createLogger|LogContext|from 'pino'` in `@vp/observability`, 0. **Done in 88d: `packages/server/logger` (T1: pino and `@opentelemetry/api` only); `LogContext` moved with it; the CLIs it now serves moved to T2.**
13. The logger has two formats behind one interface. `json` is for the deployables and has redaction, request id and trace ids. `pretty` is for CLIs, scripts and the e2e runner: a human-readable line on stderr with no JSON noise. Format and level come from the caller (config or a CLI flag), never from `process.env` inside the package. Proof: logger spec with an `it.each` over both formats. **Done in 88d: `packages/server/logger/src/__tests__/logger.test.ts`; `pretty-destination.ts` is a small formatter of our own rather than `pino-pretty` (see *Decided in 88d*).**
14. Errors are logged as a field (`log.error({ err }, 'could not mint token')`) and serialized in one place, with the message, the cause chain and the code (from `@vp/errors`, or a system one such as `EADDRINUSE`) if there is one. No hand-rolled `err instanceof Error ? err.message : err` anywhere. Proof: zero-matches row `instanceof Error \?` over production source and `tests/e2e`, 0; a serializer spec covering a cause chain and a non-Error throw. **Done in 88d: `serialize-error.ts` is pino's `err` serializer in both formats; `serialize-error.test.ts`. A non-Error object is kept as JSON with credential headers censored.**
15. No `console.` in production source, `scripts/` or `tests/e2e`, entrypoints included. The row from AC 4 widens to zero with no ENTRYPOINTS exception. Proof: the widened row. **Done in 88d: a CLI's result (a token, JWKS, help, a report table) is written to stdout as output; progress and failures go to the logger. The logger needs no `console` sink.**
16. Log calls follow one shape: a stable lowercase message plus structured fields, never values interpolated into the message (`log.info({ videoId }, 'probe queued')`, not template strings). Proof: `tests/architecture/log-calls.test.ts` (AST), with fixtures that fire on a template message, a concatenated one and a sentence-case one. **Done in 88d: 67 messages lowercased and 3 interpolated ones rewritten with their values in fields.**
17. `OTEL_TRACES_SAMPLER` takes the OpenTelemetry names (`always_on`, `always_off`, `traceidratio` and their `parentbased_` forms) and honours `OTEL_TRACES_SAMPLER_ARG`; any other value fails `loadEnv()`, and the cloud overlay samples at the ratio it says. Proof: `packages/server/observability/src/__tests__/sampler.test.ts`, one `it.each` over every name for a root span and a sampled parent; the env-schema spec refusing an unknown name and a ratio outside 0-1; the cloud overlay spec. **Done in 88f: `resolveSampler` understood `always_on`, `always_off` and a private `ratio`, and read everything else, `parentbased_traceidratio` included, as parent-based always-on, so the cloud sampled 100 %. It is an exhaustive switch in `src/sampler.ts` over `TraceSamplerName`, which `@vp/env-schema` imports as a type for its `z.enum`; the cloud overlay sets `parentbased_traceidratio` at `0.2`, as `.env.example` always claimed. The spec fails on the old parent-based case.**
18. Every ScaledObject scales on a trigger that can see a pipeline job. Proof: `k8s-keda-autoscaling.test.ts`. **Done in 88f: the Redis fallback on `transcode-480p` read `bull:transcode-480p:wait`, and KEDA's `redis` scaler reads a list length only; every pipeline job carries a priority and sits in the `:prioritized` ZSET, so the trigger could never fire. It is deleted rather than pointed at the ZSET, which the scaler cannot read, and so is `REDIS_ADDR`, which only it read (base ConfigMap, cloud patch, compose, `.env.example`, `platform-env.json`). The spec holds every ScaledObject to the one Prometheus trigger, which counts `prioritized`.**

**Decided in 88d.**
- The API's HTTP server span is a Fastify hook of our own (`plugins/request-span.ts`), not `instrumentation-fastify`: it is named by the route template the metric and the access log use, and it is started from the root context, because `instrumentation-http` runs an incoming request it ignores with tracing suppressed. Without that the span was a no-op in the running stack while every in-process spec passed; a spec now runs the request under a suppressed context. `postgres` (postgres.js) has no OpenTelemetry instrumentation, so SQL is not a span; the Tempo trace in the PR shows the server span with its `ioredis` children.
- The ESM hook excludes this repo's modules: it re-reads `export *` without the loader that resolves extensionless specifiers, so wrapping `@vp/*` failed on every barrel. Third-party modules are still wrapped. The SDK exports traces only (`metricReaders: []`, `logRecordProcessors: []`); without that it started OTLP metric and log exporters from its env defaults. `dns` and `net` instrumentation are off, they were most of the spans.
- `prioritized` joins the poller's states from one list, `QUEUE_JOB_STATES` in `@vp/core/ports`, which the BullMQ adapter (`getJobCounts(...QUEUE_JOB_STATES)`), the in-memory double and the poller read. `paused` is not in it: BullMQ 6 keeps no `paused` list (a paused queue leaves its jobs where they were), so the count could only ever be 0 and its `bullmq_queue_jobs{state="paused"}` series could never move. A paused queue is read through `isPaused`. Every pipeline job carries a priority, so BullMQ never had a pipeline job in `waiting`; the KEDA queries only ever saw the workers' `active=1`. The in-memory double now counts a job with a priority as `prioritized`, as BullMQ does.
- `promql-labels-emitted` parses every query with `@prometheus-io/lezer-promql` and reads label values from recording calls through the type checker (a literal union is its values, a `string` is any value). A series another process exports is named by prefix with the labels this repo decides (`kube_` -> the Deployment names under `infra/k8s/base`); anything else is a finding. It found two selectors matching nothing: `ScaleToZeroBroken` and the replicas panel read `deployment=~"worker-.*"`, and the Deployments are `vp-worker-*`. The alert now also counts `prioritized`.
- The k8s dashboard ConfigMaps are copies of `infra/observability/dashboards/*.json` (kustomize cannot read outside its root) and had drifted; `dashboards.test.ts` holds them equal, regenerated here.
- `time_to_ready_seconds` reads `uploads.completed_at`. A video no upload completed (a seeded one, or a reprocess of one) observes nothing rather than a guessed start.
- `@vp/logger` is T1 (pino and `@opentelemetry/api` only), so the CLIs that log through it (`dev-token`, `gen-video`, `compose-autoscaler`) move to T2. The pretty format is a 50-line destination of our own. `pino-pretty` could run in process as a plain stream, so a worker thread is not the reason; the shape is. It prints a header line and then every field on lines of its own, and an error as its raw stack, where a CLI wants `level message key=value` on one line and an error as the code and cause chain `serializeError` already produced. Getting that out of `pino-pretty` takes `messageFormat`, `hideObject` and an error formatter of our own, which is about as much code as the destination, on top of a dependency. `@vp/db` and `@vp/composition` take a structural `Log` / `ShutdownLog` (`info`/`error(fields, message)`) instead of depending on the logger, which a pino `Logger` satisfies.
- A CLI's result (a minted token, JWKS, help text, the fairness report) is written to stdout; the logger writes progress and failures to stderr, so `TOKEN=$(pnpm dev-token mint --raw)` still captures the token alone.
- `log-calls.test.ts` finds a logger by its name (`log`, `logger`, `*.log`, `*.logger`), which is the naming the repo uses; it checks the message argument, which is the first when it is text and the second otherwise (a lone argument that is not an object literal counts as the message, so `log.error(err)` fires), and fires on printf arguments and on a message that is not a literal.
- `test:unit` (`vitest run --project '!architecture*'`, which leaves out both architecture projects) is what the `unit` job runs, so the architecture suite runs once per pipeline, in `lint-typecheck`.
- `repo-files.ts` lists the index once per process and matches pathspecs in process, instead of a `git ls-files` per call. The cost was the git forks, most of the suite's wall time.
- Readiness proof uses `worker-notify` routed through toxiproxy (`docker-compose.chaos.yml` adds the `redis` proxy), since toxiproxy fronted only MinIO.
- The k3d run found a second scaling defect: each API replica polls every queue and exports the same `bullmq_queue_jobs`, so the ScaledObjects' plain `sum` counted one job once per replica and started two notify pods for one job. The KEDA queries, the replicas panel and `ScaleToZeroBroken` take `max by (state)` before they sum; the run in the PR shows one pod for one job and zero once the queue is idle.
- Every repo script runs on `tsx`, not Bun: Node is the API's production runtime, `tsx` already resolves extensionless imports, and a CI job then installs Bun only when it runs `bun test`.
- FFmpeg in CI is Ubuntu's, installed with `dpkg -i` from the `.deb` files cached per runner image (the runner's `ImageOS` and `ImageVersion`, written to a step output: they are process environment, not the `env` context) and package list. `cache-apt-pkgs-action` restored `ffmpeg` without `libblas.so.3` (every FFmpeg spec exited 127), and the static `ffmpeg-static` build broke `drawtext` and the segment probes.
- The k3d charts were wrong in two more places `make k3d-up` had not caught: the Postgres service was `vp-postgres-postgresql` while `DATABASE_URL` names `vp-postgres` (`fullnameOverride`), and charts.min.io reads `buckets`, not Bitnami's `defaultBuckets`, so no bucket existed and `/readyz` (now a real `HeadBucket`) held the API not-ready.
- `sync-tickets` no longer writes the `| Issue |` row back, since it cannot push to `main` and `GITHUB_TOKEN` may not open pull requests here. Nothing depends on the row: the sync finds a ticket's issue by its `[#NN]` title. So the job says instead of degrading silently: every ticket the sync would have linked is a warning annotation and a line in the job summary, and `pnpm sync:tickets` on a branch writes the rows into a PR like any other change.
- The KEDA values pinned image `2.14.0` against chart `2.21.0`, whose operator flags 2.14 does not know, so `make k3d-up` crash-looped KEDA. The chart version is pinned in the Makefile and the image follows it.
- e2e builds its images around the `build` job's output: `scripts/bundle-app.sh` runs `pnpm deploy --prod` from the replayed dist, and `docker-bake.hcl` hands that directory in as the `bundle` context, so the image build copies files instead of installing and compiling. On a run that changes app source (1508fa6, run 35998827861) e2e-smoke took 2m54 with a 46 s bake; the next two took 2m44 and 2m45. `packages: write` is granted to the publish job only, and `docker/bake-action` is pinned by SHA.
- MinIO is Chainguard's image, pinned by digest (`cgr.dev/chainguard/minio` and `minio-client`), because upstream stopped publishing: `quay.io/minio/*` and `minio/*` stopped resolving mid-review and took integration and e2e down with them. The compose server runs the shell-free image with the binary as entrypoint; `minio-init` and the k3d chart use the `-dev` variants, which carry the shell their scripts and the chart's `docker-entrypoint.sh` need. Checked with `make up` (buckets `raw` and `public`, API healthy) and a k3d `helm upgrade` (post-job completed). `zero-matches` fails on a `quay.io/minio` or `minio/*` image, and `minio-images-pinned.test.ts` loads the compose files and the chart values with js-yaml and fails on a MinIO `image` or chart `tag` without `@sha256:` (quoted or commented forms included).

### W10 - CI speed

Rule 11 says a cycle-time regression is a blocking defect, and the current pipeline is one. Measured on
run 35842380274: lint-typecheck 1m36, unit 4m17, unit-bun 2m34, integration 2m41, e2e-smoke 5m43, wall 10m07. About
seven builds per run, `pnpm boundaries` six times, `gen-video` four times, apt ffmpeg four times uncached, Docker
with no layer cache, architecture tests twice, no path filter (a docs-only commit ran the full 9m15), and no
`timeout-minutes` anywhere. `unit` and `unit-bun` also start a Postgres service and run `pnpm db:migrate`, and no
spec there connects to it - they use PGlite.

**Target.** Build once, cache everything that has an input hash, run e2e from cached images, and skip what a change
cannot affect.

**ACs**
1. Workspace packages are built once per run and shared (artifact or per-job cache key with `restore-keys`); no job logs `0 cached` for a package another job already built in the same run. Proof: the turbo summaries of one run pasted. **Done in 88d: the `build` job builds and is the only one that saves `.turbo/cache` under `turbo-<os>-<sha>`; every other job restores that key and replays (`pnpm exec turbo run build`, 0-1 s). Summaries in the PR.**
2. FFmpeg and the generated fixtures are cached, keyed on the generator source and `manifest.json`; e2e generates only the fixtures its reduced set uses. Proof: CI log shows a cache hit on a second run. **Done in 88d: `.github/actions/setup-ffmpeg` (the apt `.deb` files cached per runner image) and `.github/actions/video-fixtures` (keyed on `gen-video/src/**` and `manifest.json`; e2e generates `--only s2`). Cache hits in the PR.**
3. `docker buildx` uses `cache-from`/`cache-to: type=gha` in `ci.yml` and `images.yml`, with a pnpm store cache mount and a pinned turbo instead of `npx turbo`. Proof: a second run's build step under 45 s. **Done in 88d (second run 29 s, run 35992685851): e2e bakes both images side by side (`docker-bake.hcl`), `images.yml` builds each image once for the scan and once to push, all on `type=gha` scopes they share; the Dockerfiles install a pinned turbo and mount the pnpm store.**
4. Every job's `timeout-minutes` **is its budget**, so a regression fails the run instead of waiting for someone to notice: build 2, lint-typecheck 2, unit 3, unit-bun 3, integration 3, e2e-smoke 4. `e2e-smoke` needs the build job only, not the test jobs. Architecture tests run once per pipeline; `pnpm boundaries` at most once per job. Proof: `tests/architecture/ci-shape.test.ts` parses `ci.yml` and asserts each of these, with a fixture workflow that fires. **Done in 88d: `tests/architecture/ci-shape.test.ts` with a fixture workflow that fires on every rule.**
5. A PR touching only `**/*.md` or `docs/**` completes CI in under 90 s, with required checks reported. Proof: `ci-shape` asserts the path filter; the run of the first docs-only PR merged after 88d, pasted. **Done in 88d: the path filter is the first step of `build`, whose `code` output every other job gates on, so a docs-only PR reports every required check as skipped. The run of the first docs-only PR can only exist after this merges; see the PR.** **Done in 88f: #112 (the anchor fixes, `*.md` and `docs/**` only) ran CI in 12 s, run 36032186253: `build` 17:08:15-17:08:23 (8 s, the path filter said no code), and `lint-typecheck`, `unit`, `unit-bun`, `integration` and `e2e-smoke` reported as skipped at 17:08:23-24, which branch protection accepts. The same PR also started `load-smoke`, whose path list names `packages/server/**` and so matched a changed `AGENTS.md`; it failed on a registry 500 pulling an image. `load-smoke.yml` now ends its `paths` with `!**/*.md`, and `load-smoke-triggers.test.ts` holds it.**
6. On a code PR, CI wall-clock is **under 6 minutes** and `unit` under 2m30, from 10m07 and 4m17. Proof: `ci-shape` asserts that the `timeout-minutes` along the longest `needs` chain sum to 6 or less, and that `unit` is held to 150 s by `.github/actions/budget`; `gh run view --json jobs` of the last delivery PR pasted. **Done in 88d: `ci-shape` sums the chain (build 2 + e2e-smoke 4 = 6). `unit` records its start in its first step and ends with the budget step, which fails the job past 150 s (`timeout-minutes` takes whole minutes, so the timeout stays 3 and the budget step is what holds 2m30); `ci-shape` asserts the step is there with 150, first to last. First run with it (36003273621): `unit took 143483 ms of its 150000 ms budget`, too close to the line; `unit` now runs vitest on four threads (`--pool=threads --maxWorkers=4`, the runner has four cores and much of the suite waits on FFmpeg and child processes), which took the test step from 103 s to 74 s: `unit took 109576 ms of its 150000 ms budget` (run 36007115115). Four forks alone gave 126 s (run 36006523436). `unit` 2m16 and 2m26 (runs 35999524765, 36000110560), wall 3m13 and 3m07; the FFmpeg `.deb` cache now hits (its key was empty before), and `unit` no longer installs Bun, which none of its specs run.**
7. The FFmpeg-heavy specs use the `s2`/`s15` fixtures: `keyframe-alignment.test.ts` under 10 s (39.9 s today), `segment-streaming-uploader` under 5 s (21.5 s). Proof: vitest timings in the CI log. **Done in 88d: `keyframe-alignment` runs `vfr` and `s2` (half-second segments) with the three renditions in parallel, `segment-streaming-uploader` streams `s2`: 9.7 s and 2.0 s in CI (run 35992685851). Its two real encodes (nine FFmpeg processes, all cores each) then moved to `src/__tests__/integration/keyframe-alignment.test.ts`, which `@vp/ffmpeg`'s `test:integration` runs in the `integration` job, and the thumbnail specs encode `s15` instead of `s60`, to give `unit` room under its 150 s budget.**
8. `pnpm test:architecture` stays under 6 s in CI, measured as vitest's own `Duration` (first test file start to last end, not the `pnpm` command around it), with the type-aware assertions added, because they share one `ts.Program`, and a CI step fails the run when it does not. Proof: the check and its timing. **Done in 88d: 17.3 s -> 5.2-5.4 s in CI (vitest `Duration`, runs 35999524765 and 36000110560), 2.4-3.6 s locally. The target was 4 s; Mateusz moved it to 6 s after the attempts below. `lint-typecheck` runs the suite with the JSON reporter and `.github/actions/budget` fails the job when the report's first start to last end is over 6 s, CI only, so a loaded laptop does not flake it; `ci-shape` asserts the step is there with 6. First run with it (36003273621): `test:architecture took 5424 ms of its 6000 ms budget`, and 5842 ms on run 36007115115, too close to the line. `production-secrets` rendered the cloud overlay four times with `kustomize` and the PromQL and Result fixtures rebuilt a program (and bound the whole `lib`) per `it.each` row; each overlay and each fixture program is now built once per process: `test:architecture took 4307 ms of its 6000 ms budget` (run 36019209403).** `repo-files.ts` lists the index once per process and matches each glob once, `parsed-sources.ts` parses each file once, `start-order` moved to `tests/in-process`, and the suite is two processes side by side: the AST assertions in one thread and the type-aware ones in one fork over one `ts.Program`, which leaves out `lib.dom.d.ts` and caches module resolution. The typed fork is the long pole in CI: building the program and `env-keys-consumed` take 1.9 s there, the other two 0.8 s each, on top of about 1 s importing TypeScript. Tried and reverted: a fork per typed assertion, each with the smallest program it needs (server sources only for `env-keys-consumed` and `promql-labels-emitted`), took 7.64 s in CI (run 36001055967), because four processes on a four-core runner each import TypeScript and build a program. Importing TypeScript lazily saves nothing, since every file in both processes needs it and each process already imports it once.
9. `test:integration` is `cache: false` in `turbo.json`, and turbo tasks declare `inputs` that exclude `*.md` and `AGENTS.md`. Proof: a docs-only change replays every build from cache. **Done in 88d: `build`, `typecheck` and `test` take `$TURBO_DEFAULT$` minus `**/*.md`.**
10. `sync-tickets` goes green on `main`: it opens a PR or updates issues, it does not push to a protected branch. Proof: last five runs green. **Done in 88d: the job writes issues and never pushes (`contents: read`); five green runs on the branch in the PR.**
11. Trivy is pinned to a SHA and fails the image workflow on a HIGH or CRITICAL finding with a fix available. Proof: workflow file and one run. **Done in 88d: `aquasecurity/trivy-action@ed142fd` (v0.36.0), `exit-code: 1`, `HIGH,CRITICAL`, `ignore-unfixed`. Its first run failed on the images (fixable CVEs in npm's own `node_modules` and Debian packages); the runtime stages now upgrade their OS packages and drop npm and corepack, and the next run passed.**
12. `unit` and `unit-bun` start no service container and run no migration; Postgres, with the migration, is the `integration` job's service from W8 AC 4. Proof: `ci-shape` asserts no `services:` outside `integration` and `e2e-smoke`. **Done in 88d: `ci-shape` asserts no `services:` and no `db:migrate` outside `integration` and `e2e-smoke`.**
13. One runtime runs every repo script: `tsx`. Bun is a test runtime only. Every root `package.json` script and every `make` target runs TypeScript through `tsx`, and Bun is set up in `unit-bun` alone, for `bun test`. Proof: zero-matches row `bun <path>.ts` over `package.json`, the `Makefile` and `.github`, 0; `ci-shape` fails a job other than `unit-bun` that sets up Bun, and `unit-bun` when it does not. **Done in 88d: `dev-token`, `upload-client`, `compose-autoscaler`, `fairness` and `e2e` run on `tsx`, and `make e2e` runs `pnpm e2e`; none of them used a `Bun.*` API. The fairness simulation had not run on either runtime since the repositories started returning `Result`; it imports the in-memory adapters from `@vp/adapters/in-memory` and checks every `Result` now. `integration`, `e2e-smoke` and `load-smoke` no longer install Bun, and the Bun 1.4 check moved from `make doctor` to `check-bun`, which only `make test-bun` runs.**

### W11 - Documentation & drift

**Problem.** Eight `make` targets call `tools/dev-token/src/cli.ts`, which does not exist; two load scripts open
fixtures from a directory nothing writes to. `ARCHITECTURE.md` places `env-schema` in the wrong tier, documents
`checkHealth(): Promise<boolean>`, an `addFlow` that does not exist, two exception lists that do not exist, and
leaves six assertions out of its §6 table. `apps/api/src/services/README.md` names a file that does not exist and
omits seven that do. The README tree misses eight packages. SDD §13.3-13.5, §15.1 and the auth sections describe
libraries and paths the code does not use. The root `AGENTS.md` frontier policy is stale, and so is the copy
hard-coded in `gen-index.py`. 129 anchor links are broken and nothing checks links.

**Target.** A document that names a file, command, anchor or assertion is checked against the repo. The frontier is
computed, not written.

**ACs**
1. `tests/architecture/doc-links.test.ts` resolves every relative link and `#anchor` (GitHub slug rules, double hyphen for an em dash and `&`) in every tracked `.md` outside `.agents/`. `gen-index.py`'s anchor check uses the same slug rule - today it validates the single-hyphen form GitHub does not render, which is how 129 broken anchors passed it. Proof: test, with a fixture link that fires; 129 today, 0 after. **Done in 88f: `markdown.ts` parses each tracked document once per process with `markdown-it` and slugs headings with `github-slugger`; `doc-links.test.ts` fires on a single-hyphen anchor, a heading inside a code block, a missing file and a missing own heading. 131 broken anchors on `34fcdcb`, all into the SDD and PRD, fixed in #112; 0 after. `gen-index.py`'s `github_slug` numbers repeats and skips fenced blocks the way `github-slugger` does, and `gen-index.test.ts` holds the two equal over every SDD and PRD heading plus an edge-case list (em dash, `&`, code spans, repeats, unicode, a `#` line in a fence).**
2. `tests/architecture/doc-commands.test.ts`: every `pnpm <script>` and `make <target>` in `README.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `docs/standards/`, `docs/runbooks/`, `docs/SDD.md` and every `AGENTS.md` exists. Tickets and reviews are exempt as historical. Proof: test with a fixture. **Done in 88f: it reads code spans and code blocks, skips `NAME=value` prefixes, comments and pnpm's own commands, resolves `--filter` against the workspace manifests, and fires on a fixture with a missing filtered script, a missing `make` rule and a missing root script. It also holds `.PHONY` equal to the Makefile's rules, which missed twelve.**
3. `tests/architecture/architecture-table.test.ts`: the §6 table lists exactly the `*.test.ts` files in `tests/architecture/`. Proof: test. **Done in 88f: sixteen assertions were missing from the table (`ci-shape`, `class-name-inference`, `frontend-vocabulary`, `load-smoke-triggers`, `log-calls`, `minio-images-pinned`, `no-truthy-result`, `promql-labels-emitted`, `routes-unwrap-at-send-result`, `workspace-closure` and the four this PR adds). The test reads the first cell of each body row under the section 6 heading from the parsed table; rows naming a file elsewhere (`tests/in-process/start-order.test.ts`) are checked as paths by `doc-commands`.**
4. Every backticked repo path in the documents from AC 2 exists. Proof: the same test as AC 2. **Done in 88f: a code span that starts with a tracked top-level directory is a path; `<placeholder>` and `{a,b}` read as a glob that must match a tracked path, and a path git ignores (build output) passes. Twelve were missing, among them `packages/server/ffmpeg/src/segment-uploader.ts`, `packages/server/core/ports/authorization.port.ts` and `docs/adr/`.**
5. The Makefile's load and chaos targets use `pnpm dev-token`, and `make load-smoke` runs locally. Proof: zero-matches row `tools/dev-token` over `Makefile`, `.env.example` and `tests/load`, 0; the run pasted. **Done in 88f: the targets already called `pnpm dev-token` (88d); `.env.example` and two skills still named `tools/dev-token` or `tools/compose-autoscaler`, and `s2-large-file.js` and `s3-backlog-burst.js` opened `tools/gen-video/fixtures`, which nothing writes. All four point at what exists now, and the zero-matches row counts any `tools/(dev-token|gen-video|upload-client|compose-autoscaler)` over the `Makefile`, `.env.example`, `tests/load` and `.agents`, 0. `make load-smoke` now runs the nightly's profile (S1, 5 VUs for 1 min), against a stack started with `UPLOAD_RATE_LIMIT_MAX=100000` as the nightly does; locally: `244 complete and 0 interrupted iterations`, `http_req_failed 0.00%`, `checks_succeeded 100.00% 1220 out of 1220`, presign p(95) 64.78 ms, complete p(95) 59.72 ms, every threshold green.**
6. `gen-index.py` derives the frontier from ticket status and writes it into `docs/tickets/README.md`: the hard-coded frontier sentence in its README template (`gen-index.py:44`, still naming 83 and 85) is deleted. Root `AGENTS.md`'s Frontier Priority Policy (still preferring 87) is replaced by a link to the generated list. Proof: zero-matches row `Frontier Priority Policy:\*\* Ticket` over `AGENTS.md` and `docs/tickets/gen-index.py`, 0; changing a status and re-running moves the frontier. **Done in 88f: `gen-index.py` writes a `## Frontier` section, the hard-coded sentence is gone and root `AGENTS.md` links to `docs/tickets/README.md#frontier`; the zero-matches row is in. `gen-index.test.ts` changes a fixture ticket from `in-progress` to `done` and reads its dependent onto the frontier. The computed frontier on `34fcdcb` was 42, 43, 46, 48, 50, 83 and 85; the sentence said 83 and 85.**
7. SDD §11, §13.3-13.5, §15.1 and §16, `ARCHITECTURE.md`, the README tree, `docs/standards/file-discipline.md`'s example tree and `apps/api/src/services/README.md` match the code. Proof: the three doc tests green, and the README tree asserted against `packages/*/*` by `doc-commands`. **Done in 88f: every claim in those sections was read against the code; what did not match was rewritten and what is not built was deleted (the list is in the PR). `ARCHITECTURE.md` §1-4 list the ports, repositories and adapters that exist (with `env-schema` in the server tier and no `addFlow` or boolean `checkHealth`), and §6 has the sixteen missing rows. `doc-commands` holds the README tree equal to `packages/*/*`. The per-package `AGENTS.md` files, `CONTEXT.md`, the services README, `file-discipline.md`, the runbooks, the worker README and SDD §13.2 and §15.2 were brought to the code too.**
8. Ticket status uses one vocabulary; `gen-index.py` rejects anything else. Proof: script run. **Done in 88f: `ready`, `blocked`, `in-progress`, `done`, `blocked-by-date`, one word on the `**Status:**` line. 83, 85 and 86 said `ready-for-agent` and 34 carried a note on the line; both are fixed, and `gen-index.test.ts` runs the script on a fixture with `ready-for-agent` and reads the refusal. `gen-index.py --check` writes nothing and exits 1 on a stale index, so the suite runs it on every pipeline.**

9. Root `AGENTS.md` says which runtime runs what, one row each with its reason, and nothing contradicts it: no repo script runs on Bun. Proof: the zero-matches row `bun <path>.ts` over `package.json`, the `Makefile` and `.github`, 0; `ci-shape` on Bun set up outside `unit-bun`. **Done in 88f: the table has the API (Node 24, for OpenTelemetry's module hooks), the worker (Bun by default, Node with `WORKER_RUNTIME=node`), scripts, CLIs, migrate, seed and the e2e runner on `tsx` (`dev-token help` 0.19 s against Bun's 0.04 s, measured here), vitest, and `bun test` as the dual-runtime proof. Both assertions are 88d's.**
10. `scripts/` and `tests/` are typechecked. Proof: `pnpm typecheck` runs `tsconfig.repo.json`. **Done in 88f: `typecheck:repo` is a cached turbo root task that `pnpm typecheck` and CI run. It maps `@vp/*` to source, so a spec that imports a package by name and one that imports its source by path see one type. It found four e2e files importing `Repositories` from `@vp/core/ports` (it lives in `@vp/core/repositories`) and two reconciler calls with no `metrics` and one of their two thresholds missing, which would have thrown on the first pass.**

**Decided in 88f.**
- The doc tests parse markdown with `markdown-it` (`mdast-util-from-markdown` with GFM took 750 ms over the 233 documents, `markdown-it` 68 ms) and slug with `github-slugger`. `markdown.ts` parses each document once per process for all three.
- `gen-index.py`'s slug is `github_slug`, a small function over the same rule; `gen-index.test.ts` pipes every SDD and PRD heading, and an edge-case list, through `gen-index.py --anchors` and compares with `github-slugger`. `--check` turns the script into a CI check, so the index, the vocabulary and the ticket anchors are held on every pipeline, not when someone remembers to run it.
- The anchor fixes went out first as #112, alone, so its run is W10 AC 5's proof. `gen-index.py` is under `docs/**`, so its slug fix rode along without leaving the docs-only path.
- A backticked path is a code span starting with a tracked top-level directory. Placeholders are `<name>` or `{a,b}` and must match a tracked path as a glob, so `docs/tickets/NN-slug.md` became `docs/tickets/<NN>-<slug>.md`. A git-ignored path passes, since it is what a build or an install writes.
- `ticket-index.test.ts` is `gen-index.test.ts`: `no-process-comments` fires on the word in a test title.
- `.PHONY` is one line listing the rules in file order; `doc-commands` compares it with the rules as sets. `make up` starts the four infrastructure services it says it starts; it used to start everything.
- `make load-smoke` runs the nightly's profile rather than its own 60 VUs for 2 minutes, which the default upload limit (30 per user per minute) could not pass.
- The doc assertions run in the AST thread and took the suite to 5.7-6.0 s in CI (runs 36036516403, 36037361626; the second failed its budget at 6038 ms). Placeholder paths are matched only against paths sharing their literal prefix, `gen-index.test.ts` runs its four invocations side by side, and `esm-specifiers` parses only a file with a quoted relative path ending in an extension (715-903 ms before): `test:architecture took 5183 ms of its 6000 ms budget` (run 36038583817). Tried and reverted: the doc assertions in a third lane on `vmForks`, which re-imports every module per file and took the suite to 6.9 s. That held one run in five, so `gen-index.test.ts` moved to the `in-process` project, and a CPU profile of both lanes gave the rest: `matchesGlob` compiles its glob on every call, so a glob is asked only about the files under its literal directory with its literal ending (`repo-files.test.ts` compares the result with plain `matchesGlob` over the index); `typescript` loads through `createRequire` (`tests/architecture/typescript.ts`, aliased in both configs), since an `import` runs Node's format detection and export lexer over the 9 MB bundle in each lane; `test-correspondence` reads the AST before it transpiles a source; the three `kustomize` runs start together. Four CI runs at ee51b7c: 4443, 4170, 4351 and 4245 ms of the 6000 ms budget (run 36101589580 and three reruns of its `lint-typecheck`), against 5069-6482 ms before.
- `FIXTURES.VIDEO_ID` in `@vp/testing` held the seed's dev user id. It is the seeded video (`018f0000-...0001`) now, `DEV_USER_ID` the user, and `USER_ID` and `SAMPLE_MP4_KEY`, which nothing read, are gone. The values stay literals: `@vp/testing` cannot import the seed from `@vp/db`.
- `tsconfig.repo.json` maps the packages with subpath exports one by one (`adapters`, `core`, `db`, `domain`, `storage`, `testing`) and the rest through `@vp/*`: TypeScript `paths` take one `*`. A new package with subpath exports fails `typecheck:repo` until it is listed, which is the reminder.
- The web app's page loaded `bootstrap-icons` from jsdelivr and preconnected to Google Fonts and two Facebook hosts. The icons are an `apps/web` dependency now, bundled by CRA, and `local-first` fails on an off-machine host in `apps/web/public/*.html`.
- `tools/hls-test-page`'s sample button fetched a stream from `test-streams.mux.dev`. It plays `sample/index.m3u8` beside the page now, which `make hls-sample` cuts from the `s15` fixture, and `local-first` holds `tools/hls-test-page/*.html` with the web app's page.
- `infra/terraform/terraform.tfvars`, `*.tfstate` and `.terraform/` are git-ignored; `docker-compose.toxiproxy.yml` is deleted (nothing referenced it, the `chaos` profile replaced it).
- Out of 88: CI does not run `terraform fmt -check` or `terraform validate`. `validate -backend=false` refuses `cloudflare_r2_bucket_lifecycle`, `cloudflare_r2_custom_domain` and `cloudflare_tunnel`, which the pinned `cloudflare ~> 4.35` provider does not have, so a check would be red from its first run. The port to provider v5 and the CI step are [ticket 90](90-cloud-terraform-provider-v5.md). `main.tf` is `terraform fmt`-clean here, and `terraform fmt -check -recursive` passes.
- Three defects found while reading the docs against the code became ACs: W1 AC 12 (the worker's R2 token), W9 AC 17 (the trace sampler) and W9 AC 18 (the KEDA Redis fallback).

---

## Ratchets this ticket leaves behind

Every one is a flat assertion with a fixture that proves it fires, and none has an allowlist.

| Assertion | Holds |
|---|---|
| `zero-matches` | every one-off count in this ticket stays where the PR that moved it left it |
| `no-discarded-result` | no `Result` is dropped without `ignore(result, reason)` |
| `no-module-state` | no module-level mutable state or import-time side effect outside a `main.ts` |
| `no-tuning-literals` | tuning values live in `AppConfig`, declared once |
| `env-keys-consumed` | every declared key is read; every config leaf is consumed |
| `env-confinement` (reads `entrypoints.ts`) | `process.env` only in the entrypoints and the named env homes |
| `file-ceiling` (specs included) | 400 lines / 10 KB for every tracked `.ts`/`.tsx` |
| `test-correspondence` (no list) | every source with runtime code has its spec, every tier |
| `spec-discipline` | no vitest-global imports, sleeps, elapsed-time asserts, duplicate titles, skips |
| `no-process-comments` | no ticket, AC or step references in code, specs or test titles |
| `esm-specifiers` (inverted) | no extension on a relative import, any tier |
| `no-in-probes` | unions discriminate on a literal `type` |
| `error-vocabulary` | every persisted code is an `ErrorCode` |
| `no-test-hooks` | no fault injection in production code or wire contracts |
| `production-secrets` | rendered production manifests carry no local credential |
| `promql-labels-emitted` | every label value a query needs is emitted |
| `start-order` | consumers start last |
| `ci-shape` | per-job budgets as `timeout-minutes`, critical path at 6 min, path filter, services only where specs use them |
| `redis-keys-owner` | one owner per key family |
| `doc-links`, `doc-commands`, `architecture-table` | documents name only what exists |
| `gen-index` | the ticket index is current, one status vocabulary, the frontier computed |
| `knip` in CI | no unused file, export, type or dependency |
| `biome --error-on-warnings` | no lint warning survives |

---

## Delivery

One ticket, six PRs, each independently green and each ticking only its own workstreams. The ACs bind the ticket,
not a PR. Branches are `ticket/88a-security-config`, and so on; every PR title starts `88a:` … `88f:`.

| PR | Workstreams | Why this order |
|---|---|---|
| 88a | W1, W2 | the exploitable finding ships first; configuration is what W1 reads |
| 88b | W3, W4, W5 | lifecycle, DI and errors share the composition modules; `no-discarded-result` needs the `ts.Program` the other type-aware tests reuse |
| 88c | W6, W7 | the mechanical sweep: `.js` removal, file ceiling, knip, single owners. Largest diff, least judgement |
| 88d | W9, W10 | observability and CI touch infra and workflows only; can run in parallel with 88c |
| 88e | W8 | the spec burn-down, against the code 88a-88d left; `apps/web` last inside it |
| 88f | W11 | documents describe the final state, so they go last; the three doc tests land here |

88c and 88d may run in parallel. Everything else is sequential. Each PR deletes the list it empties in the same
PR; no PR adds an entry to any list.

---

## Out of scope

- **Replacing the frontend stack.** 49-75 own React 19, TanStack and Tailwind. W8 writes specs for the code that
  exists; if 53-55 later delete a component, they delete its spec with it.
- **Coverage percentages.** The 1:1 rule and the contract suites are the mechanism here, not a threshold.
- **A distributed rate limiter.** Per-pod limits stay; W1 AC 11 fixes the exemption and the client key. A
  Redis-backed store needs an SDK in `apps/api` and is its own ticket.
- **New product behaviour.** The only behaviour changes allowed are the ones an AC names.

---

## Notes for the implementer

- Build the shared `ts.Program` helper for `tests/architecture/` first (88b). Four assertions need the type
  checker, and building one Program per test file is what would break AC W10.8.
- Fold before you write: the 12 misnamed specs and the contract-per-file split pay about 40 list entries without a
  new assertion. Do those before writing a single new spec.
- Delete before you spec. knip (W7) will find dead sources on the correspondence list; a deletion beats a spec.
- The audit's reproduce commands are in [the audit](../reviews/88-codebase-health-audit.md). Quote before and after
  for each count in the PR that moves it.

---

## Definition of Done

Every AC ticked with pasted evidence · six PRs reviewed and approved, each with green CI · `pnpm boundaries`,
`pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, output
pasted · `make smoke-offline` and `make e2e` (`E2E_REDUCED=true`) green, and the reduced e2e set runs in CI ·
`tests/architecture/` holds no exception list and `repo-files.ts` no `shrinkOnly` · `ARCHITECTURE.md` §6,
`docs/standards/*.md` and SDD updated in the PR that changes what they describe · `**Status:** done` and
`python3 docs/tickets/gen-index.py` re-run · no new external runtime dependency.
