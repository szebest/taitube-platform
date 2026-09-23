# 88 audit - codebase health at `64eff79`

Read after 87 merged. It is the evidence behind [ticket 88](../tickets/88-codebase-health-ratchets.md): each
count below comes with the command that reproduces it, so the PR that moves a number can quote before and after.
Paths are relative to the repo root. Commands exclude `node_modules`, `dist` and specs unless they say otherwise.

The codebase and its docs were machine-generated, and the docs describe an intended system. Every claim here was
checked against the code, and several claims in the previous scorecard were wrong in both directions.

## Scorecard

| Dimension | Previous | Today | Main reason for the change |
|---|---|---|---|
| Security & authorization | 8 | 4 | a forgeable admin token in production, a crash hook over HTTP, dev seed in the migrate Job |
| Configuration | 6.5 | 6 | 25 unread keys (not 24), 17 non-identity tuning fallbacks plus default parameters, overlays unchecked |
| Lifecycle | 9 | 8 | handlers installed after start, liveness passes on a missing heartbeat, no worker readiness |
| Dependency injection | 8 | 7 | `total-dependencies` cannot see default params or `?? call()`; 5 `new` inside services |
| Boundaries & file discipline | 8 | 7.5 | 19 specs over 400 lines, ~20 unused dependencies |
| Errors | 8 | 7 | ~36 discarded Results; `.catch(` invisible to `catch-confinement` |
| Hygiene & single owners | 6 | 6 | confirmed, with `accessible-by`/`rules-to-sql` refuted as dead |
| Tests | 6.5 | 6 | the integration job integrates nothing; 4 of 5 nightlies red |
| Observability | - | 5 | the API logs nothing; KEDA cannot scale a worker to zero |
| CI speed | - | 5 | ~7 builds per run, a cache-key race, no Docker cache, no path filter |
| Documentation | - | 6 | 129 broken anchors, SDD §13 and auth sections describe libraries the code does not use |
| Drift | 7.5 | 7 | 8 Makefile targets, ARCHITECTURE.md names lists that do not exist |

## Security & authorization

| Finding | Evidence | Reproduce |
|---|---|---|
| Dev JWKS served in every environment, and prod points at it | `apps/api/src/routes/index.ts:20`, `routes/dev-jwks.ts:10`, `infra/k8s/base/configmap-secret.yaml:28`, seed in `packages/server/dev-token/src/keys.ts:23` | `grep -n devJwksRoutes apps/api/src/routes/index.ts; grep -n AUTH_JWKS_URL infra/k8s/base/configmap-secret.yaml` |
| `iss`/`aud` never compared on the JWKS path | `apps/api/src/plugins/jwks-verifier.ts:177-187` (exp, nbf, sub only); `AUTH_ISSUER`/`AUTH_AUDIENCE` not in `AppConfig.auth` | `grep -nE "iss\|aud" apps/api/src/plugins/jwks-verifier.ts` |
| Unknown `alg` falls back to RSA-SHA256; kid-less token takes `keys[0]`; ES256 always fails (no `dsaEncoding`) | `jwks-verifier.ts:73-74`, `:138`, `:156` | read |
| JWKS cache is module state with a 5 min TTL and no refetch on unknown kid | `jwks-verifier.ts:33-40` | `grep -n "let jwksCache" apps/api/src/plugins/jwks-verifier.ts` |
| Every admin-token request is one hard-coded user, never provisioned | `apps/api/src/plugins/auth.ts:12-15,46-48` | `grep -rn 000000000003 apps packages --include='*.ts' \| grep -v __tests__` |
| `x-test-crash-after-commit` honoured in production | `apps/api/src/routes/uploads.ts:121`, `services/upload-complete.ts:185` | `grep -rn "x-test-" apps/api/src` |
| Fault flags in wire contracts | `ThumbnailJob.forceFailure`, `ProbeJob.forceThumbnailFailure` in `packages/server/job-contracts/src/index.ts:41,59`; `simulateFailureRendition` in `apps/worker/src/stages/transcode.ts:36,59,158` | `grep -rnE "forceFailure\|forceThumbnailFailure\|simulateFailure\|testCrash\|killAtPercent" apps packages --include='*.ts' \| grep -v __tests__` |
| Migrate Job seeds dev data | `apps/api/src/migrate.ts:3,12` (imports `@vp/db/seed`, calls `seedDatabase`), run by the Job as `node dist/migrate.js` | `grep -n seedDatabase apps/api/src/migrate.ts` |
| CORS reflects any origin | `apps/api/src/app.ts:54` | `grep -n "register(cors" apps/api/src/app.ts` |
| Base secrets pass the `^change-me` check | `configmap-secret.yaml:57-64` (`vp`, `minioadmin`, `vp:vp@`, `:vp@`) | `grep -nE '"(vp\|minioadmin)"\|:vp@\|vp:vp' infra/k8s/base/configmap-secret.yaml` |
| Cloud overlay never includes its secrets; `secrets.enc.yaml` is plaintext in fake wrappers | `infra/k8s/overlays/cloud/kustomization.yaml:6-10` | read |
| Rate-limit admin exemption ignored (`skip` is not an option in 11.2.0); `trustProxy` unset; no `bodyLimit` | `apps/api/src/routes/videos.ts:98`, `app.ts:47,56-59` | `grep -rn "rateLimit\|bodyLimit\|trustProxy\|skip:" apps/api/src --include='*.ts' \| grep -v __tests__` |

Refuted: no inline role or user-id authorization checks in `apps/api/src`; Bull Board is gated by `requireAdmin`
and not behind the ingress.

## Configuration

| Finding | Count | Reproduce |
|---|---|---|
| Declared keys | 68 | `grep -cE '^  [A-Z][A-Z0-9_]+:' packages/server/env-schema/src/app-env.ts` |
| Mapped by `toAppConfig` | 43 | `grep -oE 'env\.[A-Z][A-Z0-9_]+' packages/server/env-schema/src/app-config.ts \| sort -u \| wc -l` |
| Declared and not mapped | 25 | `comm -23` of the two lists above |
| Mapped and consumed by nothing | `redis.pubsubUrl` | `grep -rn pubsubUrl apps packages --include='*.ts' \| grep -v __tests__` |
| Partly consumed | `redis.password` (BullMQ only), `worker.tmpDir` (housekeeping only) | `external-family.ts:23,43`; `stages/probe.ts:145`, `transcode.ts:170` |
| URL defaults with a password | 3 schema + 1 `inProcessAppConfig` + 3 db scripts | `grep -nE "(postgres(ql)?\|redis)://[^\"' ]*:[^@\"' ]+@\|minioadmin"` over production source = 9 lines |
| `process.env` outside the two mains | 15 files (including `@vp/testing`, `tests/e2e/e2e-runner.ts`, `scripts/run-e2e.ts` and the `apps/web/src/Globals.d.ts` declaration), 9 sanctioned by name in `env-confinement.test.ts:15-25` | see ticket W2 AC 3 |
| Composition roots defaulting config | 2 (`app.ts:37`, `runner.ts:67`) | `grep -rn "?? inProcessAppConfig" apps packages` |
| Numeric `??` fallbacks in services, stages, adapters | 56, 17 excluding the identity `?? 0`/`?? 1` | `grep -rnE '\?\? *[0-9][0-9_]*' apps/api/src/services apps/worker/src packages/server/adapters/redis packages/server/adapters/s3 --include='*.ts' \| grep -v __tests__` |
| Overlay keys unchecked | `HOUSEKEEPING_INTERVAL_MS` in `infra/k8s/overlays/cloud/kustomization.yaml:48` | `env-key-closure.test.ts:90` reads `base` only |

The 25 unread keys: `ALLOWED_CONTENT_TYPES`, `AUTH_AUDIENCE`, `AUTH_DEV_USER_ID`, `AUTH_ISSUER`, `BULLMQ_PREFIX`,
`CORS_ORIGINS`, `DO_NOT_TRACK`, `FFMPEG_PATH`, `FFPROBE_PATH`, `GOP_SECONDS`, `HLS_SEGMENT_SECONDS`,
`JOB_TIMEOUT_FACTOR`, `MAX_DURATION_SEC`, `NODE_OPTIONS`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`,
`PUBLIC_API_URL`, `REDIS_ADDR`, `S3_PART_SIZE_MAX_BYTES`, `S3_PART_SIZE_MIN_BYTES`, `TRANSCODE_MODE`,
`TURBO_TELEMETRY_DISABLED`, `WEBHOOK_SIGNING_SECRET`, `WEBHOOK_URL_ALLOWLIST`, `WORKER_RUNTIME`.
`.env.example` and the schema agree key for key.

## Lifecycle

- Worker consumes before metrics and heartbeat: `apps/worker/src/main.ts:31` (start, `new Worker` autoruns) before `:34` (metrics) and `:40-44` (heartbeat). A metrics bind failure calls `process.exit(1)` at `:75-77` with jobs in flight.
- Both mains attach signal handlers after `main()` resolves (`apps/worker/src/main.ts:69`, `apps/api/src/main.ts:71-73`).
- API drain order is correct: readiness flips, 2 s drain, close, dispose, all inside a 20 s grace window (`packages/server/composition/src/shutdown.ts:17,36-57`).
- Worker liveness is `test -f /tmp/vp/heartbeat || exit 0` - a missing file is healthy. Zero readiness probes across 8 worker manifests.
- Heartbeat file written from 5 places: `probe.ts:90`, `transcode.ts:100,232`, `thumbnail.ts:71`, `main.ts:22`, in two formats. `main.ts:22` writes epoch seconds, the stages write ISO strings, and the probe's `$(( $(date +%s) - $(cat heartbeat) ))` is a syntax error on an ISO string.

## Dependency injection

| Finding | Count | Reproduce |
|---|---|---|
| Production files calling `getMetrics()` | 15 | `grep -rl 'getMetrics(' apps packages --include='*.ts' \| grep -v -e __tests__ -e observability/src/metrics.ts \| wc -l` |
| Module-scope `let` in runtime code | 3 (`jwks-verifier.ts:33`, `metrics.ts:229`, `tracing.ts:35`) | `grep -rnE '^(export )?(let\|var) ' apps packages --include='*.ts' --include='*.tsx' \| grep -v __tests__` |
| Module-scope instances | `defaultPaginator`, `defaultCursorCodec`, `apps/web/src/lib/time-ago.ts:7` | `grep -rnE '^(export )?const \w+(: [^=]+)? = new [A-Z]' apps packages --include='*.ts' \| grep -v -e __tests__ -e 'new Set'` |
| Import-time side effect | `apps/api/src/plugins/metrics.ts:11-14` | read |
| `new` of a collaborator inside services and stages | 5 | `grep -rnE 'new [A-Z]\w*\(' apps/api/src/services apps/worker/src/stages --include='*.ts' \| grep -v __tests__ \| grep -Ev 'new (Date\|Map\|Set\|Error\|Promise\|URL)\('` |
| Bull Board inside `queue-service` | 4 lines | `grep -rn '@bull-board\|createBullBoard\|new FastifyAdapter' apps/api/src/services` |

`total-dependencies.test.ts` matches only `?? new X` and `?? defaultX` in two roots: default parameters,
destructuring defaults, `?? getMetrics()` and `app.ts`/`runner.ts` are outside it.

## Errors

- `@vp/result` has no `ignore()`.
- About 36 statement-level discards. Behaviour-changing ones: `apps/worker/src/stages/housekeeping/expire-raw.ts:47-50,60`, `reconcile-uploads.ts:72,124,140-142`, `reconcile-processing.ts:112`, `purge-deleted.ts:89-91,110`, `transcode.ts:231`. Cache writes: `apps/api/src/services/subscription-service.ts:67,68,88,89,115`, `reaction-service.ts:58,59`. Inconsistent pair: `video-lifecycle.ts:75` discards the `enqueueProbe` that `upload-complete.ts:198` checks.
- `catch-confinement` regex `(^|[^\w.])catch\s*[({]` skips `.catch(`: 43 method catches, 20 in services and stages. `grep -rcE '\.catch\??\.?\s*\(' apps/api/src/services apps/worker/src/stages --include='*.ts'`.
- `legacy-catch-sites.ts`: 22 entries.
- Throws one call away from the domain roots: `validateJobId` (`apps/worker/src/job-identity.ts:14-20`, 5 callers), zod `.parse(` 9 times inside the roots.
- Codes outside the vocabulary: `'ORPHANED'` (`reconcile-processing.ts:96,98,117`), `'UNRECOVERABLE_ERROR'` (`failure-handler.ts:60`); `errorCode: string` in `step-repository.ts:19,60`, `dlq-repository.ts:13`.
- Classification by message text: `transcode-failure.ts:20-23`.
- `'x' in obj` narrowing: 10 sites (5 server, 5 web). `grep -rnE "['\"][\w-]+['\"] in [\w.]+" apps packages --include='*.ts' --include='*.tsx' | grep -v __tests__`.
- `as unknown as`: 14 in 9 files. `@ts-ignore`, `@ts-expect-error`, non-null `!`: 0.
- FST 4xx errors (`FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`) become 500: `apps/api/src/plugins/errors.ts:44-95` handles 429, known codes and `.validation` only. A bodyless POST with no content type is 200 (the body is optional in the contract); with `content-type: application/json` it is 500.

## Boundaries & file discipline

- Specs over 400 lines: 19; over 250: 30; over 10 KB: 24. Largest: `housekeeping-reconciler-purge` 810. `git ls-files -- '*.test.ts' '*.test.tsx' | xargs wc -l | awk '$2!="total" && $1>400' | wc -l`.
- `file-ceiling.test.ts` uses `productionSources()`, which drops specs and `tests/`. `oversized-sources.ts`: 5 entries.
- `.js` on relative imports: `packages/universal` 277 of 277, `packages/client` 5 of 5, universal specs 43 of 173; every other tier 0. `esm-specifiers.test.ts` requires any extension in universal and client source.
- `apps/web` is plain CRA 5 (`react-scripts` 5.0.1), no craco or `config-overrides`.
- Unused declared dependencies: worker `@vp/domain-rules`, `@vp/db`, `@vp/validation`, dev `@electric-sql/pglite`; api `@fastify/jwt`, `@fastify/swagger-ui`, `@fastify/under-pressure`, dev `@electric-sql/pglite`; adapters `@vp/domain-rules`; db `@vp/errors`, `uuidv7`, dev `@electric-sql/pglite`; upload-client `@vp/errors`, `@vp/storage`, dev `@vp/core`; web `lodash`, `react-bootstrap-icons`, `react-redux`, `web-vitals`. No knip, ts-prune or depcheck in the repo; counts are word-boundary scans.

## Hygiene & single owners

| Finding | Count | Reproduce |
|---|---|---|
| `decidePartManifest`/`decideSizeMatch` importers outside their tests | 0; copies at `upload-complete.ts:72-75,155` | `grep -rn "decidePartManifest\|decideSizeMatch" apps packages \| grep -v -e __tests__ -e domain-rules/src` |
| `PROBLEM_CONTENT_TYPE =` | 2 | `grep -rn "PROBLEM_CONTENT_TYPE =" apps packages` |
| `private unavailable(` in adapters | 21 | `grep -rlE "^\s*private unavailable\(" packages/server/adapters \| grep -v __tests__ \| wc -l` |
| BullMQ `checkHealth` bodies pasted | 2; S3 `checkHealth` stubs `return ok()` | `grep -rn "async checkHealth" packages/server/adapters \| grep -v __tests__` |
| Files building Redis keys or channels | 6, prefix `taitube:`, plus `'bull'` twice | `grep -rnE "taitube:\|'bull'" apps packages --include='*.ts' \| grep -v __tests__` |
| Hand-built S3 keys | `purge-deleted.ts:55,59,90,96,98`, `expire-raw.ts:48`, `seed.ts` 8 sites, `fairness-simulation.ts:132` | `grep -rnE '\`(raw\|videos)/\$\{' apps packages scripts \| grep -v -e __tests__ -e storage/src/keys.ts` |
| Rendition ladder definitions | 4 (`CANONICAL_LADDER`, dead `DEFAULT_LADDER`, `seed.ts:66`, `purge-deleted.ts:97`) | read |
| Ticket/AC comments in production source | 77 | see ticket W7 AC 6 |
| Numbered-step comments in production source | 62 | same |
| Values exported, used only in own file | 54 (plus 257 types) | scan; confirm with knip |
| Exported, referenced nowhere | 34 (7 values) | scan |
| Exported, used only by tests | 135 (122 values) | scan |
| Package-entrypoint exports with no outside importer | 468 (280 values) | scan |
| Biome warnings | 64 (60 `noExplicitAny`, 4 `useSimplifiedLogicExpression`) | `biome lint . --max-diagnostics=200` |

Refuted: `packages/server/adapters/postgres/scopes/accessible-by.ts` and `rules-to-sql.ts` are live through
`videoReadScope`, `ownerScope` and `publicVisibilityScope`. Only `accessibleBy` and `getConditionSql` are
test-only exports.

## Tests

| Finding | Count | Reproduce |
|---|---|---|
| `untested-sources.ts` | 130: web 53, worker 16, api 6, server packages 47, universal 4, scripts 4 | `grep -c "^  '" tests/architecture/untested-sources.ts` |
| Specs covering a listed source under the wrong name or directory | 12 | see ticket W8 AC 10 |
| Repository contract suites already present, bundled | 12 in one file, PGlite + in-memory | `packages/server/adapters/__tests__/contract/` |
| Specs importing from `vitest` | 54 (all runtime imports) | `grep -rlE "from ['\"]vitest['\"]" apps packages tests --include='*.test.ts' --include='*.test.tsx' \| wc -l` |
| Fixed sleeps in specs | 18, plus 4 in e2e helpers | `grep -rnE "setTimeout\|setImmediate" apps packages tests --include='*.test.ts'` |
| Elapsed-time asserts | 2 (`uploads.test.ts:151`, `outbox-relay.test.ts:312`) | `grep -rn "elapsed" apps packages --include='*.test.ts'` |
| AC/ticket/step references in specs | 257 (141 test titles, 63 `//` comments) | `rg -n -g '*.test.ts' -g '*.test.tsx' '\bAC[ -]?[0-9]+\|\bAC-\|[Tt]icket [0-9]+\|\(ticket\|#[0-9]{2}\b\|Step [0-9]' apps packages tests scripts \| wc -l` |
| `typeof import(`, `importOriginal<` | 0 | keep at 0 |
| `vi.useFakeTimers` | 1 file | `grep -rl useFakeTimers apps packages` |
| Spy files with no restore, and no `restoreMocks` in config | 14 of 26 | `comm -23` of `vi.spyOn` files against `restoreAllMocks\|mockRestore` files |
| `console.log` in specs | 7 | `grep -rn "console.log" apps packages --include='*.test.ts'` |
| Skips | 1 (`it.skipIf`, R2) | `grep -rnE '\b(it\|test\|describe)\.(skip\|only\|todo\|skipIf\|runIf)\b' apps packages tests` |
| Copied fixtures | `createMockJob` 3x (shared one unused), `setupUploadedVideo` 4x, `freePort` 2x, one UUID literal 44x | `grep -rnE "^\s+(async )?function (createMockJob\|setupUploadedVideo\|createVideo\|freePort)" apps packages` |
| `test:bun` scope | `apps/worker packages` only - `apps/api`'s 77 specs never run under Bun | `package.json:18` |
| `integration` | `test:integration` is `vitest run` in both packages that define it; no spec reads a real service URL | `grep -n test:integration apps/*/package.json packages/*/*/package.json` |

Flakiness: the nightly load smoke failed 09-19, 09-20, 09-21 (100% `http_req_failed`, an outage) and 09-22
(`http_req_duration{name:presign}`), passed 09-23. The presign threshold also failed twice on the 87 branch.
One Bun-only CI failure on the 84 branch: `redis-reaction-cache.adapter.test.ts:167-204` patches `Math.random`
and waits on a 20 ms `settle()`. No CI evidence of a segment-streaming-uploader failure; its disk-bound
assertion races a real 100 ms interval against a 10 ms sampler.

## Observability

- API: `fastify({ logger: false })` (`apps/api/src/app.ts:47`), so `request.log.error` in `plugins/errors.ts:85` is a no-op. No redaction anywhere, no request id.
- `console.*` in production source: 108 calls in 17 files, most in CLIs; runtime ones in both mains, `migrate.ts`, `tracing.ts`, `load-env.ts`, `compose-autoscaler/runner.ts`, `gen-video/generator.ts`.
- Tracing initialised inside `main()` after the static imports it patches (`apps/api/src/main.ts:63`, `apps/worker/src/runner.ts:69`); nothing preloads it. Inferred ineffective, to confirm with Tempo.
- `reconcile-uploads.ts:130` hard-codes a `traceparent`.
- Worker writes `bullmq_queue_jobs{state="active"}=1` per job and never resets it (`stages.module.ts:46`), scraped by the workers ServiceMonitor, queried by KEDA with `activationThreshold: "0"`.
- `result="stalled"` (alert) and `state="prioritized"` (KEDA, dashboard) are never emitted.
- `http-metrics.ts:25` falls back to `req.url` on a 404.
- Default metrics collected twice (`metrics.ts:41` and `apps/api/src/plugins/metrics.ts:12-14`); two metrics servers.
- `time_to_ready_seconds` measures from `video.createdAt` (`apps/worker/src/stages/package.ts:274`).
- `neon_compute_hours_used` panel has no exporter (`storage-cost.json:336`).
- 22 metrics registered, 0 registered-but-unemitted; `reconciler_repairs_total` and `outbox_events_published_total` used by no dashboard or alert.
- `bad-codec.mov`: 16 fixtures in `packages/server/gen-video/manifest.json`, none of them `bad-codec`; `tests/e2e/specs.ts:68,250-251` needs it in the reduced set; CI runs `make smoke`, never `make e2e`.

## CI speed

| Run | lint-typecheck | unit | unit-bun | integration | e2e-smoke | wall |
|---|---|---|---|---|---|---|
| 35842380274 (ticket 84) | 1m36 | 4m17 | 2m34 | 2m41 | 5m43 | 10m07 |
| 35847065181 (docs only) | 0m24 | 3m07 | 2m26 | 2m49 | 6m03 | 9m15 |

- `pnpm build` in 4 jobs plus `typecheck`'s `^build` plus 2 Docker builds: about 7 per run. `pnpm boundaries` 6 times. `gen-video` 4 times (~20 s each). apt ffmpeg 4 times uncached (15-33 s). Architecture tests twice.
- All five jobs save to `turbo-Linux-${sha}`; only the first save wins (`Unable to reserve cache` in three jobs), and lint-typecheck never builds the apps.
- No `cache-from`/`cache-to` on any Docker build; e2e "Build and start entire stack" 3m03 in both runs.
- No path filter, no `timeout-minutes` on any job.
- `sync-tickets.yml` red on every main push since 09-19 (`GH006: Protected branch update failed`, run 35869663909).
- `images.yml`: Trivy `@master`, `exit-code 0`, `continue-on-error`.
- Slowest specs: `keyframe-alignment.test.ts` 39.9 s, `segment-streaming-uploader.test.ts` 21.5 s, `thumbnail-stage.test.ts` 9.7 s.
- `unit` and `unit-bun` start a Postgres service and run `pnpm db:migrate`; no spec there connects (PGlite).
- `turbo.json`: no `inputs` on any task; `test:integration` cacheable although it runs against live infra.

Reproduce: `GH_CONFIG_DIR="$HOME/.config/gh-szebest" gh run view <id> --json jobs --jq '.jobs[]|[.name,.startedAt,.completedAt]|@tsv'`.

## Documentation & drift

- Makefile: 8 targets call `tools/dev-token/src/cli.ts`, which does not exist (`grep -c "tools/dev-token/src/cli.ts" Makefile` = 8). `tests/load/s2-large-file.js:6`, `s3-backlog-burst.js:7` open `tools/gen-video/fixtures/`. `.env.example:74,133` names `tools/dev-token`.
- `ARCHITECTURE.md`: `env-schema` placed under `packages/universal/` (`:34`); layout misses `domain-rules`, `result`, `validation`, `composition`, `concurrency`; "singleflight" under redis (`:53`); `checkHealth(): Promise<boolean>` (`:76-81`); "all ports extend HealthCheckable" (4 do not); `addFlow` (`:125-129`, does not exist); `.clear()` on every double (3 lack it); "five exception lists" naming `throwing-domain-sources.ts` and `non-result-port-methods.ts` (`:345-348`, neither exists; also `apps/worker/AGENTS.md:40`); §6 table misses `class-name-inference`, `frontend-vocabulary`, `load-smoke-triggers`, `no-truthy-result`, `routes-unwrap-at-send-result`, `workspace-closure`.
- `apps/api/src/services/README.md` names `admin-access.ts` (does not exist) and omits 7 files. `for f in apps/api/src/services/*.ts; do grep -q "$(basename $f)" apps/api/src/services/README.md || echo $f; done`.
- `README.md:75-113` tree misses 8 packages.
- Wrong paths: `docs/SDD.md` `observability/otel.ts`; `docs/runbooks/worker-disk.md` `ffmpeg/src/segment-uploader.ts`; `docs/standards/authorization.md` `authorization.port.ts`.
- Wrong commands in live docs: `apps/web/README.md` `pnpm --filter @vp/web dev`; `docs/SDD.md:1647` `pnpm compose:scale`; `infra/terraform/README.md:30` `test:terraform`.
- SDD spot-check, 14 claims, 7 false: `apps/api/src/sse/`, `apps/api/src/queues/`, `apps/api/test/`, under-pressure registered, §13.3 path and working auto-instrumentation, §13.4 AsyncLocalStorage bindings, §13.4 "last 50 lines" of stderr (probe keeps the first 500 chars), §13.5 `observability/` path. Auth: SDD says `@fastify/jwt` (`:1544`) and claim checks on `AUTH_ISSUER`/`AUTH_AUDIENCE` (`:2166`); neither is true.
- Links: 758 local links, 0 broken files, 129 broken anchors under GitHub slug rules (em dash and `&` headings slug to a double hyphen). `gen-index.py`'s `anchor()` validates the single-hyphen form, so it passes them. No link check in CI.
- Frontier policy stale in root `AGENTS.md` (says prefer 87) and hard-coded in `gen-index.py` (says 83 and 85).
- Status vocabulary: 83, 85, 86 use `ready-for-agent`; others `ready`.
