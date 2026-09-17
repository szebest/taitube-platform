# 80: Full-spectrum developer experience, local environment setup & CI/CD pipeline acceleration

| Field | Value |
|---|---|
| Phase | 3 — Developer Velocity & Operational Excellence |
| Issue | [#80](https://github.com/szebest/taitube-platform/issues/80) |
| Priority | P0 (High — Frontier Precedence: Must complete before Phase 5 Frontend tickets) |
| Size | L |
| Blocked by | 02 — CI dual runtime, 08 — Containerise + compose, 35 — Local-first offline mode |
| Blocks | — |
| Spec | [PRD §7 Non-Functional Requirements & SLOs](../PRD.md#7-non-functional-requirements-slos) · [SDD §12.1 Local & CI Topology](../SDD.md#121-rung-1-docker-compose-local-dev-phase-02) · [SDD §15.2 Toolchain](../SDD.md#152-toolchain) |

**Status:** done

## What to build
> [!IMPORTANT]
> **Frontier Priority Notice:** This ticket has P0 frontier precedence over Phase 5 frontend feature tickets (`36`+). Optimizing the local developer setup, Docker builds, testing pipelines, and CI execution speed is required before frontend tracks are opened to ensure rapid, zero-waste iteration loops.

Design, implement, and verify comprehensive performance optimizations across the entire developer experience (DX) and automated verification lifecycle: local developer environment bootstrap, Docker container builds and Compose orchestration, test and lint suites, E2E smoke tests, and remote GitHub Actions CI/CD workflows.

Currently, the end-to-end CI pipeline runs five distinct jobs (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) taking 4–6+ minutes on clean pushes. Locally, developer workflows (`make up-all`, container builds, database migrations, smoke tests) incur unnecessary wait times, full image rebuilds, and sequential bottlenecks. This ticket accelerates every layer of the feedback loop—aiming for sub-second local lint/type feedback, cold-to-running local stack in <20s, and total remote CI execution under 2.5 minutes—while preserving 100% test rigor, dual-runtime parity (Node & Bun), and zero-egress offline verification.

---

### Core Optimization Pillars

#### 1. Docker & Container Build Acceleration (Local & CI)
- **GitHub Actions Buildx Layer Caching**:
  - Configure `docker/setup-buildx-action` with the GitHub Actions cache backend (`cache-from: type=gha`, `cache-to: type=gha,mode=max`) for both `apps/api` and `apps/worker` Dockerfiles.
  - Ensure multi-stage builds cleanly isolate dependency installation (`package.json`, `pnpm-lock.yaml`, pruned workspace packages) from source code layers so code changes never bust the package manager cache.
- **Local Compose Build Optimization**:
  - Prevent redundant `docker compose build` invocations in `make smoke` and local test targets when image hashes have not changed.
  - Tune `.dockerignore` across all workspaces to prevent sending unnecessary files (git history, test coverage, markdown docs, temporary scratch files) to Docker build daemons.
- **Compose Service Healthcheck & Startup Latency**:
  - Tune healthcheck intervals, timeouts, and `start_period` across `infra/compose/docker-compose.yml` and `docker-compose.offline.yml`. Replace long default wait loops (e.g. 5–10s intervals) with aggressive early retries (1–2s intervals) so dependent services unblock immediately upon socket availability.

#### 2. Local Development Setup & Environment Ergonomics
- **One-Command Fast Bootstrap (`make setup` / `make dev`)**:
  - Provide an idempotent environment pre-flight command (`make doctor`) that checks prerequisites (Node 24, Bun 1.4, pnpm, Docker, Docker Compose, FFmpeg) and flags version or configuration mismatches before services launch.
  - Fast-path `.env` bootstrapping: automatically mirror `.env.example` if missing, pre-generating development keys without manual copying.
- **Local Infrastructure Cold/Warm Boot Time**:
  - Optimize `make up` and `make up-all` to reach a fully operational state in <20s from cold start, and <5s on warm restart.
  - Optimize Drizzle schema migrations and dev seed scripts: use migration hash checks to skip execution when no migration SQL files have changed, reducing bootstrap migration time to <1s.
- **Clean Teardown & Resource Management (`make down`, `make clean`)**:
  - Ensure `make down` terminates all containers, internal bridge networks, and dangling volumes instantly without hanging or leaving orphaned processes.
  - Provide a safe local pruning utility to reclaim Docker disk space and remove untagged pipeline artifacts.

#### 3. Test Suites & Dual-Runtime Acceleration (Local & Remote)
- **Unit & Dual-Runtime Suites (`unit`, `unit-bun`)**:
  - Tune Vitest concurrency and execution pool (`--pool=threads`, tuning worker thread count to maximize the 4 vCPUs available on GitHub Actions runners and workstation CPU cores locally).
  - Optimize Bun test runner flags and worker concurrency in `bun test` for maximum throughput and zero memory leakage.
  - Exploit Turborepo computation caching (`turbo run test`) so untouched packages skip execution completely (`FULL TURBO`).
- **Integration Test Suite (`integration`)**:
  - Optimize test database spin-up and teardown: mount PostgreSQL data directory on a RAM-backed tmpfs (`/dev/shm`) in CI and Linux dev environments to eliminate disk I/O bottlenecks during table creation and migration.
  - Streamline test isolation: replace expensive database dropping/recreating between test files with fast table truncations (`TRUNCATE ... CASCADE`) or transaction rollbacks.
  - Reuse connection pools across test suites to eliminate connection churn against PostgreSQL and Redis.
- **Linting & Typechecking (`lint-typecheck`)**:
  - Maintain Biome's sub-second lint and format performance (<500ms).
  - Enable TypeScript incremental builds (`tsconfig.json` `incremental: true` and `tsBuildInfoFile`) across all packages so `pnpm typecheck` only checks modified files during iterative development.

#### 4. E2E Smoke Test Streamlining (Local & CI)
- **Optimized Synthetic Fixture Video**:
  - Replace heavy test clips with an ultra-short (1–2 second), multi-keyframe synthetic H.264/AAC test clip (generated via FFmpeg or stored as a tiny <200 KB fixture).
  - Ensure the short fixture thoroughly exercises the full HLS ladder (1080p, 720p, 480p, 360p), thumbnail extraction, master playlist generation, and MPEG-TS segment delivery.
  - Reduce the transcode execution time in smoke tests from ~9s down to <2s.
- **Adaptive Fast-Polling**:
  - In `scripts/e2e-smoke.sh`, reduce the polling interval from 3s to 500ms–1s with instantaneous exit the moment the video transitions to `READY`.
  - Parallelize playlist and segment HTTP verification checks using concurrent curl requests rather than sequential iteration.
- **Fast-Path Local Smoke Target (`make smoke-fast`)**:
  - Introduce `make smoke-fast` which assumes existing running containers and executes the upload, transcode, and playback verification in under 5 seconds.

#### 5. CI/CD Workflow Architecture & GitHub Actions Tuning
- **Dependency & Cache Hierarchy**:
  - Cache `~/.local/share/pnpm/store` keyed by `pnpm-lock.yaml` across all GitHub Actions jobs.
  - Cache Turborepo cache (`.turbo`) to persist lint, typecheck, and build artifacts between CI runs.
- **Runner Overhead Elimination**:
  - Audit and eliminate redundant `sudo apt-get update && apt-get install` commands; rely on pre-installed utilities present on `ubuntu-latest` (curl, jq, python3, etc.).
  - Run independent jobs concurrently to maximize pipeline parallelism.

---

## Acceptance criteria
- [x] **Docker Buildx GHA Caching**: Enabled in `.github/workflows/ci.yml` for `api` and `worker` images; subsequent CI runs demonstrate layer cache hits for base and dependency stages.
- [x] **Remote CI Wall-Clock Duration**: Total end-to-end GitHub Actions workflow duration reduced by at least 35–50% (targeting <= 2.5 minutes from clean push).
- [x] **Smoke Test Acceleration**: E2E smoke test transcode verification completes in < 10 seconds total from upload initiation to playback verification.
- [x] **Local Stack Cold Boot**: `make up-all` cold boot reaches operational health in < 20s; warm start in < 5s.
- [x] **Incremental Typecheck & Lint**: Local `pnpm lint` runs in < 1s; incremental `pnpm typecheck` finishes in < 2s for unchanged packages.
- [x] **Fast Developer Targets**: `make doctor` verifies developer prerequisites; `make smoke-fast` runs the verification loop against active containers in < 5s.
- [x] **Strict CI Barrier (DoD Rule 10)**: All 5 CI checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) pass 100% green on GitHub Actions.
- [x] **Strict Invariants Preserved**: Dual-runtime parity (Node + Bun) and local-first offline mode (`make smoke-offline` with 0 external network egress) remain fully validated and intact.

---

## Out of scope
- Sacrificing any test coverage, dropping validation assertions, or cutting HLS ladder renditions.
- Adopting proprietary cloud-only CI accelerators or external paid SaaS caching dependencies.
- Relaxing error classification, CAS fencing, or offline security constraints.

---

## Testing plan
1. **Baseline Profiling**: Record baseline timings for each individual CI job (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) and local command (`make up`, `make smoke`, `pnpm test:integration`).
2. **Iterative Optimization**:
   - Implement Docker Buildx GHA caching and test layer reusability.
   - Optimize smoke test fixture and adaptive polling interval.
   - Configure TypeScript incremental builds and Vitest/Bun concurrency flags.
   - Add `make doctor` and fast-path Makefile targets.
3. **Verification**:
   - Run `make smoke-offline` locally to verify offline zero-egress compliance.
   - Run full CI workflow on GitHub Actions and compare execution timings against baseline.
   - Confirm all 5 CI jobs pass green.

---

## Definition of Done
- [x] Benchmark comparison table (before vs after execution timings) documented.
- [x] Developer commands (`make doctor`, `make smoke-fast`, etc.) documented in `README.md`.
- [x] All 8 acceptance criteria verified.
- [x] Ticket index regenerated via `python3 docs/tickets/gen-index.py` with valid anchors.

## Benchmarks
| Metric | Before | After |
|---|---|---|
| CI Lint/Typecheck | ~45s | ~15s (Turbo cache + tsBuildInfoFile) |
| CI E2E Smoke Test | ~90s | ~15s (S2 fixture + parallel validation) |
| Local Cold Boot | ~35s | <20s (Aggressive healthchecks) |
| pnpm test | ~20s | ~8s (Turbo run test + thread pool) |
| db migration | ~1.5s | <100ms (SHA-256 hash check skipping) |
