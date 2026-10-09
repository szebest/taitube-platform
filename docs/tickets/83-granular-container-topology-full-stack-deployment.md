# 83: Granular container topology — per-app images, a one-app dev loop and a single orchestrated launch

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 82 — Architecture remediation, package runtime tiers & contract seams |
| Blocks | — |
| Spec | [SDD §12.1 Rung 1 Compose](../SDD.md#121-rung-1--docker-compose-local-dev-phase-02) · [SDD §12.2 Rung 2 Kubernetes](../SDD.md#122-rung-2--kubernetes-locally-kind-or-k3d-phase-3) · [SDD §12.3 Rung 3 Cloud](../SDD.md#123-rung-3--cloud-reference-deployment-phase-4) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** done

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Ticket 85 note:** `@vp/intl`, `@vp/messages` (both `universal`) and `@vp/intl-react` (`client`) are new
> packages in the build graph — include them in the per-app Docker build contexts, the `pnpm deploy --prod`
> prune and the turbo cache keys. See [85](85-universal-intl-formatting-message-core.md).

> **Ticket 84 note:** `@vp/result`, `@vp/validation` and `@vp/domain-rules` are three new `universal`
> packages in the build graph — include them in the per-app Docker build contexts, the `pnpm deploy --prod` prune and the turbo
> cache keys. See [84](84-result-typed-error-handling-shared-domain-rules.md).

> **Ticket 87 note:** three things this ticket needs, whichever lands first.
> `@vp/composition` and `@vp/concurrency` (both `server`) are new packages in the build graph — same treatment
> as above. The API gains the `SIGTERM`/`SIGINT` drain the worker already has, so the per-app images and the
> compose/k8s stop behaviour (`STOPSIGNAL`, `stop_grace_period`, `terminationGracePeriodSeconds`, `preStop`)
> must give it time to run rather than assume an instant exit. And the raw/public bucket env keys are
> reconciled on `S3_BUCKET_RAW` / `S3_BUCKET_PUBLIC`: any `STORAGE_*_BUCKET` written into a compose or manifest
> env block by this ticket is already dead. See [87](87-composition-root-typed-container-config-value.md).

---

## Why this ticket exists

**`apps/web` has no deployment path of any kind.** No Dockerfile, no compose service, no k8s manifest, no
ingress route. Ticket 08 containerised `api` and `worker` and closed Phase 1; every ticket since has assumed
the frontend would arrive with the rewrite, and ticket 82 explicitly deferred it. Nothing else picked it up,
so the platform can be exercised end to end only by `curl`. After 82 the frontend finally talks to the real
API over a single-sourced contract — which is exactly what makes shipping it worth doing.

Two further gaps, both Rule 11 (optimal execution, zero waste):

1. **Launching is all-or-nothing.** `make up` starts infrastructure; `make up-all` starts infrastructure plus
   `migrate`, `api` and **all eight** worker stages. There is nothing in between. A developer fixing a
   thumbnail bug pays for seven irrelevant worker containers, and someone working only on the frontend still
   boots the whole transcode ladder to get an API to talk to.
2. **There is no single orchestrated entrypoint.** Bringing the full system up today means chaining
   `make up` → `make build-images` → `make up-all` → `make obs-up`, each with its own readiness assumptions,
   and knowing which order they go in. Health gating is per-service; nothing sequences the stack as a whole
   or reports what came up and where to reach it.

The existing compose file already proves the mechanism: `hls-test-page` sits behind a `tools` profile, the
observability six behind `observability`, `toxiproxy` behind `chaos`. Profiles are the right tool and they
are used for three side-concerns while the core services — the ones a developer actually chooses between —
have none.

---

## What to build

### A — Ship `apps/web`

- **Dockerfile** for `apps/web`, matching the topology `apps/api/Dockerfile` already uses: `turbo prune
  --docker` → install → build → a minimal Node runtime stage serving the SSR build
  (after 89, the `start` script: srvx on port 5173). Non-root, read-only root filesystem, no build toolchain
  in the final image.
- **Compose service** `web`, with the API base URL injected as configuration rather than baked at build time
  where the runtime allows it. It joins the same network as `api`.
- **k8s manifest** under `infra/k8s/base/` plus an `ingress.yaml` route, consistent with the existing
  per-workload manifests.
- **Image build + scan in CI**: `images.yml` publishes `vp-web` alongside `vp-api` and `vp-worker`, multi-arch,
  Trivy-gated on CRITICAL.
- **Local-first (Rule 1):** the web image must serve entirely from within the compose network. Extend
  `make smoke-offline` to cover it — ticket 82's local-first assertion checks *source*, and this is what
  closes the runtime half.

### B — Granular, per-app launch

One target that starts exactly what is asked for, and only the infrastructure that thing needs:

```
make up                     # infrastructure only (unchanged)
make up api                 # infra + migrate + api
make up web                 # infra + migrate + api + web
make up worker              # infra + migrate + every worker stage
make up worker:transcode    # infra + migrate + one stage
make up all                 # everything, via the orchestrator below
```

- Give each core service a compose profile so a subset is expressible, keeping the existing `tools`,
  `observability` and `chaos` profiles working.
- **Declare each service's dependencies once.** A per-app dependency map that both the Make target and the
  orchestrator read is the point of this section; two hand-maintained lists of "what does `web` need" is the
  defect this ticket exists to avoid repeating.
- Preserve the `WORKER_STAGE`-only pattern — one worker image, eight services, no per-stage images.

### C — One orchestrated full-stack launch

A single entrypoint that brings the system up in dependency order, gates each tier on real health rather
than sleeps, and finishes by printing what is running and where to reach it.

- Ordering: infrastructure → `minio-init` + `migrate` → `api` → workers → `web` → optional profiles.
- Health gating uses the existing container health checks; nothing polls on a timer where a health check exists.
- On failure it names the service that failed and prints that container's last log lines — not a stack trace
  from the orchestrator.
- Tear-down and status are the same entrypoint (`make down`, `make status`), so there is one thing to learn.
- It supersedes the `make up` → `build-images` → `up-all` → `obs-up` chain rather than wrapping it. Ticket 82
  W8 collapses the 4-layer e2e wrapper chain for the same reason; do not build a fifth here.

### D — Build performance (Rule 11)

- Shared base stage across the three app images so the pnpm install layer is built once, not three times.
- Buildx layer caching wired in CI, with the cache actually keyed to hit.
- Ticket 82 W9 puts every package under a tier directory — use it to make each image's `COPY` list exact, so
  a frontend-only change cannot invalidate the API image's layers.
- Record the resulting image sizes and cold/warm build times in the PR; a regression is a blocking defect.

### E — Prove it end to end

- A browser-driven check against the **deployed containers** — not a dev server — that uploads a fixture,
  waits for `READY` and plays it back through the web container.
- Ticket 75 owns the full Playwright suite; this ticket lands the one path that proves the topology works.

### F - Bundle each app, and retire the extensionless-import loader shim

`packages/server/config/src/register.js` is a `registerHooks()` resolve hook whose only job is to catch
`ERR_MODULE_NOT_FOUND` and retry the specifier with `.js` (or `/index.js`) appended. The API and the worker
boot through it (`NODE_OPTIONS="--import @vp/config/register"`), because every package builds with plain
`tsc`, is `"type": "module"`, and `tsc` emits relative specifiers verbatim while Node does no extension
resolution.

**Decided: relative imports stay extensionless in every tier, and nothing adds an extension.** No `.js` on any
relative import, in source, specs or generated code, and no resolver flag that exists to tolerate one
(`resolve.fullySpecified` and friends). What changes is what Node is handed: each deployable is bundled, so
the bundler resolves the extensionless specifiers at build time and the runtime sees none.

- **Decided:** `apps/api` and `apps/worker` build with esbuild into one ESM file per entrypoint, in
  `dist/bundle/`: `main.js` and `instrument.js` for both, `migrate.js` and `seed.js` for the API. Shared code
  lands in chunks beside them, so `--import ./dist/instrument.js dist/main.js` loads one copy. Workspace
  `@vp/*` packages are inlined; npm dependencies stay external, because OpenTelemetry patches them through
  Node's module hooks and pino resolves its transports by path. They come from
  `pnpm deploy --prod --config.public-hoist-pattern='*'`, which links every one of them at the top of
  `node_modules` while the store keeps one copy of each version (`node-linker=hoisted` copies duplicates
  and made the image 20 MB bigger), and the deploy's `@vp` copies are then deleted. The API's build keeps
  `tsc` emitting `dist/` for its library export (`composeApp`, which `upload-client`'s spec imports); nothing
  imports `@vp/worker`, so its build is the bundle alone and `typecheck` stays the worker's `tsc` run.
- **Decided:** `apps/web` keeps its build. 89 made it TanStack Start on Vite, which already bundles: the
  `@vp/*` packages resolve from source through `vite/workspace-sources.ts` and are inlined into
  `dist/server/server.js` and `dist/client`, npm dependencies stay external, and `start` serves the build
  with srvx on port 5173. Those externals drag Vite, Rollup, esbuild and Babel into a `pnpm deploy --prod`
  (`@tanstack/react-start` depends on them), so the image takes `dist/server` bundled once more by
  `scripts/bundle-entrypoints.ts --inline-npm` with every dependency inside, plus `dist/client` and srvx:
  9 MB of app instead of 260 MB of `node_modules` with a build toolchain in it.
- The images copy the bundle to `/app/dist` and no `dist/` tree of any workspace package, which also shrinks
  the `COPY` list D asks for. The image paths stay `dist/main.js`, `dist/instrument.js` and `dist/migrate.js`,
  so the k8s commands and the migrate Job are unchanged.
- `register.js` is deleted, with the `./register` export of `@vp/config`, and `NODE_OPTIONS` leaves the
  Dockerfiles, compose, `.env.example` and `@vp/env-schema`. The apps' `dev` scripts run the source through
  `tsx`, so the dev loop has no build step; only the images run the bundle.
- Repo scripts and CLIs keep running through `tsx` (the root runtime table), which resolves extensionless
  imports; vitest and `bun test` already do.
- `tsc` stays the typecheck and declaration build for packages. `moduleResolution: "bundler"` in
  `packages/universal/tsconfig/base.json` is now accurate rather than a convenience, so it stays.
- `esm-specifiers.test.ts` is not touched. [Ticket 88](88-codebase-health-ratchets.md) W6 already inverted
  it: no relative import in any tier carries an extension.

This lands here because the shim sits in the entrypoint this ticket is rewriting anyway.

---

## Acceptance criteria

- [x] `apps/web` has a Dockerfile, a compose service, a k8s manifest and an ingress route; `vp-web` is built
      multi-arch in CI and Trivy-scanned. **The `web` target of the root `Dockerfile`, the `web` compose
      service, `infra/k8s/base/web.yaml` and the Ingress catch-all `/`; `images.yml` builds and scans it (the
      dispatched run passed its Trivy gate).**
- [x] The web container runs as non-root with a read-only root filesystem and contains no build toolchain.
      **uid 10001, `read_only: true` in compose and `readOnlyRootFilesystem` in k8s; `/app` is `dist/` and
      `node_modules/srvx` (9 MB), and npm, npx, corepack and yarn are removed from the runtime.**
- [x] `make up <app>` starts that app and only the infrastructure it needs, for `api`, `web`, `worker` and a
      single worker stage; `make up` alone still starts infrastructure only. **`topology.test.ts` per target;
      local run of `make up web` and `make up worker`.**
- [x] Each service's dependencies are declared in exactly one place, read by both the Make target and the
      orchestrator - no second hand-maintained list. **`depends_on`, read from `docker compose config`.**
- [x] One orchestrated entrypoint brings the full stack up in dependency order, gates on container health
      checks rather than sleeps, prints a service/URL table on success, and on failure names the failing
      service and shows its logs. **`pnpm stack` (`packages/server/stack`); a broken migrate printed
      `migrate failed: exited (3)` and its log.**
- [x] `make down` and `make status` are served by the same entrypoint; the old
      `up` -> `build-images` -> `up-all` -> `obs-up` chain is gone, not wrapped.
- [x] The three app images share one base stage; buildx caching is keyed so it hits; image sizes and
      cold/warm build times are recorded in the PR and no worse than today's for `api`/`worker`.
- [x] A frontend-only change does not invalidate the API or worker image layers - demonstrated. **A line
      appended to `apps/web/src/router.tsx` re-runs `pruner` only; `deps`, `build-api`, `api-bundle` and
      `api` are CACHED (4 s), the worker likewise (3 s).**
- [x] `make smoke-offline` covers `apps/web`; the web container serves with zero external egress.
      **`scripts/assert-no-egress.sh` checks api and web; CI `e2e-smoke` runs it.**
- [x] A browser-driven check uploads, waits for `READY` and plays back through the deployed web container.
      **`pnpm test:browser` (`tests/browser/playback.ts`), in CI `e2e-smoke` beside the API smoke.**
- [x] `apps/api` and `apps/worker` ship an esbuild bundle per entrypoint; the images contain no workspace
      package `dist/` tree and boot with no `--import` loader.
- [x] `register.js` is deleted and nothing registers a resolve hook; `grep -rn "registerHooks\|register(" packages/server/config`
      returns nothing.
- [x] No relative import in any tier gains an extension in this ticket, and `esm-specifiers.test.ts` is not
      widened.
- [x] `make smoke-offline` passes from the bundled images; migrate runs from `dist/migrate.js` in the Job.
      **CI `e2e-smoke` is the same sequence on the offline overlay.**
- [x] **Docs:** SDD §12.1/§12.2 updated with the `web` service and the profile map; `README.md` quick-start
      updated to the new entrypoint; `Makefile` help text accurate; `docs/LOCAL_FIRST.md` covers the frontend.
- [x] `python3 docs/tickets/gen-index.py` re-run.

## Open questions

- **Decided:** one root `Dockerfile` with `api`, `worker` and `web` targets, not three per-app files. A
  shared `deps` stage needs one file; each app still builds from its own `turbo prune` output.
- **Decided:** the dependency map is compose's own `depends_on`. App services get a profile each
  (`migrate`, `api`, `web`, `worker`), the infrastructure none, and `pnpm stack` enables the profiles of
  the dependency closure it starts.
- **Decided:** `SSR_API_BASE_URL`, not a `VITE_` name: it is read by the SSR server when it starts, and a
  `VITE_` key is inlined by Vite into both bundles at build time. It is parsed by the web's own schema in
  `apps/web/src/config` behind `import.meta.env.SSR`, declared in `platform-env.json` (the API and the
  worker never read it), and `vite/bundle-guard.ts` fails a client chunk that reads `process.env`.
- **Decided:** no fixed `container_name` in compose. Names derive from the project, so a second stack under
  another project name cannot collide with or remove this one; scripts find a container by its compose
  labels.
- **Decided:** the browser check uses `playwright-core` against the runner's own Chrome (no browser
  download). It presses play itself, because the legacy player pauses on hls.js's opening seek.
- **Decided:** every image carries an explicit current tag, no `:latest`: Postgres 16 -> 18 and Redis 7 -> 8
  in compose and k8s (a Postgres 16 data directory needs `make down` or `pg_upgrade`; 18 mounts at
  `/var/lib/postgresql`), the observability images pinned to the versions `:latest` resolved to (Tempo to
  3.1.0, checked against `tempo.yml`), and the Helm charts pinned in `make k3d-up`. Node stays on 24: Node 26
  moves in its own PR with Vitest 5.
- Left for a security chore: `images.yml` fails its Trivy gate on `main` and here alike (fastify 5.12.1,
  @grpc/grpc-js 1.14.4, brace-expansion 2.1.4 and 5.0.9); the fix is lockfile bumps.

---

## Out of scope

- The `apps/web` framework rewrite. The framework rewrite is [89](89-web-tanstack-start-foundation.md) (then
  53-74). This ticket ships whatever `apps/web` is at the time; after 89 that is a TanStack Start Node server
  (`start` script), not static files.
- The full Playwright acceptance suite — ticket 75.
- Cloud deployment of the frontend (Terraform, CDN, custom domains). Tickets 31–33 own the cloud rungs;
  extend them once the local topology is proven. The cloud overlay deletes `vp-web` and its Ingress route
  until then, since `images.yml` builds the image with no `VITE_API_BASE_URL`; the cloud rung adds it back.
- Autoscaling the web tier. KEDA scaling is queue-driven and ticket 26 owns it.

---

## Notes for the implementer

- **Read `infra/compose/docker-compose.yml` before designing the profile map.** The `tools`, `observability`
  and `chaos` profiles and the `worker-probe: &worker` YAML anchor already establish the conventions.
- **One image per app, not per service.** Eight worker services share one image through `WORKER_STAGE`; keep
  that property.
- **Do not add a runtime dependency on anything outside the compose network** (Rule 1). A CDN font or a
  hosted API in the web image fails `make smoke-offline`.
- **Prove, don't claim** (Rule 9): paste build times, image sizes and the smoke output in the PR.
