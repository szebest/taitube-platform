# 83: Granular container topology — per-app images, a one-app dev loop and a single orchestrated launch

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 82 — Architecture remediation, package runtime tiers & contract seams |
| Blocks | — |
| Spec | [SDD §12.1 Rung 1 Compose](../SDD.md#121-rung-1--docker-compose-local-dev-phase-02) · [SDD §12.2 Rung 2 Kubernetes](../SDD.md#122-rung-2--kubernetes-locally-kind-or-k3d-phase-3) · [SDD §12.3 Rung 3 Cloud](../SDD.md#123-rung-3--cloud-reference-deployment-phase-4) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready-for-agent

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
  --docker` → install → build → a minimal static runtime stage. Non-root, read-only root filesystem, no
  build toolchain in the final image.
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

`packages/server/config/src/loader.mjs` is a `register()` hook whose only job is to catch
`ERR_MODULE_NOT_FOUND` and retry the specifier with `.js` appended. Every app boots through it
(`node --import @vp/config/register dist/main.js`), because every package builds with plain `tsc`, is
`"type": "module"`, and `tsc` emits relative specifiers verbatim while Node does no extension resolution.

The fix is not to change the source. **Relative imports stay extensionless in every tier**, and nothing in this
ticket adds an extension anywhere. What changes is what Node is handed: each deployable is bundled.

- `apps/api` and `apps/worker` build with esbuild (a devDependency) into one ESM file per entrypoint -
  `dist/main.js` for both, `dist/migrate.js` for the API. Workspace `@vp/*` packages are inlined; npm
  dependencies stay external and come from `pnpm deploy --prod`, as today. esbuild resolves extensionless
  specifiers itself, so the bundle has none left for Node to resolve.
- The per-app images (A-D) copy the bundle, not `dist/` trees of every workspace package, which also shrinks
  the `COPY` list D asks for.
- `loader.mjs` is deleted and `@vp/config/register` loses its resolver duty; if nothing else is left in it,
  it is deleted and `NODE_OPTIONS` in the Dockerfiles and compose drops the `--import`.
- The CLIs keep running through `bun`, which resolves extensionless imports; vitest and `bun test` already do.
- `tsc` stays the typecheck and declaration build for packages. `moduleResolution: "bundler"` in
  `packages/universal/tsconfig/base.json` is now accurate rather than a convenience, so it stays.
- `esm-specifiers.test.ts` is not widened. [Ticket 88](88-codebase-health-ratchets.md) W6 inverts it: no
  relative import in any tier carries an extension, and `apps/web` gets `resolve.fullySpecified: false` for the
  workspace packages it consumes. Either ticket can land first - until 83 lands, the loader covers an
  extensionless `universal` package exactly as it covers `server` today.

This lands here because the shim sits in the entrypoint this ticket is rewriting anyway.

---

## Acceptance criteria

- [ ] `apps/web` has a Dockerfile, a compose service, a k8s manifest and an ingress route; `vp-web` is built
      multi-arch in CI and Trivy-scanned.
- [ ] The web container runs as non-root with a read-only root filesystem and contains no build toolchain.
- [ ] `make up <app>` starts that app and only the infrastructure it needs, for `api`, `web`, `worker` and a
      single worker stage; `make up` alone still starts infrastructure only.
- [ ] Each service's dependencies are declared in exactly one place, read by both the Make target and the
      orchestrator — no second hand-maintained list.
- [ ] One orchestrated entrypoint brings the full stack up in dependency order, gates on container health
      checks rather than sleeps, prints a service/URL table on success, and on failure names the failing
      service and shows its logs.
- [ ] `make down` and `make status` are served by the same entrypoint; the old
      `up` → `build-images` → `up-all` → `obs-up` chain is gone, not wrapped.
- [ ] The three app images share one base stage; buildx caching is keyed so it hits; image sizes and
      cold/warm build times are recorded in the PR and no worse than today's for `api`/`worker`.
- [ ] A frontend-only change does not invalidate the API or worker image layers — demonstrated.
- [ ] `make smoke-offline` covers `apps/web`; the web container serves with zero external egress.
- [ ] A browser-driven check uploads, waits for `READY` and plays back through the deployed web container.
- [ ] `apps/api` and `apps/worker` ship an esbuild bundle per entrypoint; the images contain no workspace
      package `dist/` tree and boot with no `--import` loader.
- [ ] `loader.mjs` is deleted and nothing registers a resolve hook; `grep -rn "register(" packages/server/config`
      returns nothing, or the package is gone.
- [ ] No relative import in any tier gains an extension in this ticket, and `esm-specifiers.test.ts` is not
      widened.
- [ ] `make smoke-offline` passes from the bundled images; migrate runs from `dist/migrate.js` in the Job.
- [ ] **Docs:** SDD §12.1/§12.2 updated with the `web` service and the profile map; `README.md` quick-start
      updated to the new entrypoint; `Makefile` help text accurate; `docs/LOCAL_FIRST.md` covers the frontend.
- [ ] `python3 docs/tickets/gen-index.py` re-run.

---

## Out of scope

- The `apps/web` framework rewrite (React 19 / TanStack Start / Tailwind). Tickets 49–75 own it. This ticket
  ships whatever `apps/web` is at the time.
- The full Playwright acceptance suite — ticket 75.
- Cloud deployment of the frontend (Terraform, CDN, custom domains). Tickets 31–33 own the cloud rungs;
  extend them once the local topology is proven.
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
