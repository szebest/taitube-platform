# 80: CI/CD test suite optimization & pipeline execution acceleration

| Field | Value |
|---|---|
| Phase | 3 — Developer Velocity & Operational Excellence |
| Issue | [#80](https://github.com/szebest/taitube-platform/issues/80) |
| Size | M |
| Blocked by | 02 — CI dual runtime, 08 — Containerise + compose, 35 — Local-first offline mode |
| Blocks | — |
| Spec | [PRD §7 Performance & Developer Experience](../PRD.md#7-non-functional-requirements-slos) · [SDD §12.1 Local & CI Topology](../SDD.md#121-rung-1-docker-compose-local-dev-phase-02) |

**Status:** ready

## What to build
Profile, optimize, and streamline the complete testing, linting, build, and E2E verification pipelines across both local developer workstations and remote GitHub Actions CI.

Currently, the full CI workflow runs five sequential and parallel jobs (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) totaling ~4–6 minutes per run. Opportunities exist to dramatically reduce cycle times, eliminate redundant operations, and maximize caching while preserving rigorous test depth and local-first verification.

### Optimization Areas:

1. **GitHub Actions Workflow & Buildx Caching**:
   - Leverage GitHub Actions cache backend (`type=gha`) for Docker Buildx so application images (`api`, `worker`) reuse layer caches between CI runs instead of rebuilding dependencies from scratch.
   - Cache pre-built packages and `pnpm install` artifacts across workflow jobs.
   - Optimize system package installation (`apt-get`) or use pre-installed runner capabilities to shave 20–30s off job startup overhead.

2. **E2E Smoke Test Streamlining**:
   - Optimize the test video fixture for smoke runs: use the shortest valid input (e.g. 1-2s fixture or minimal keyframe test clip instead of 15s where appropriate) while maintaining full rendition ladder coverage (`1080p`, `720p`, `480p`, thumbnail, master playlist, TS segment).
   - Fast-poll readiness checks: decrease polling interval from 3s to 500ms–1s with immediate exit upon `READY` transition.
   - Optimize healthcheck startup timeouts and compose container build contexts.

3. **Unit, Bun Parity & Integration Test Speedups**:
   - Tune Vitest and Bun concurrency settings to fully utilize available runner cores (`4` vCPUs on GitHub Actions).
   - Optimize test isolation and eliminate unnecessary database truncations/reconnects during integration runs.
   - Exploit Turborepo remote/local computation cache for lint, typecheck, and unit suites so unmodified packages execute in milliseconds (`FULL TURBO`).

4. **Local Developer Feedback Loops**:
   - Provide optimized fast-path npm/make targets (e.g. `make smoke-fast`, `pnpm test:fast`) that run targeted slices in under 15 seconds.
   - Maintain Biome formatting/linting performance (<1s) and ensure zero config drift.

## Acceptance criteria
- [ ] Docker Buildx GHA caching enabled in `.github/workflows/ci.yml` for `api` and `worker` images, significantly reducing `docker compose build` time on subsequent runs.
- [ ] Smoke test fixture and polling optimized so end-to-end transcode verification finishes in < 15s after container readiness.
- [ ] Overall GitHub Actions workflow wall-clock duration reduced by at least 35–50% without skipping any tests or cutting validation depth.
- [ ] Local `make smoke` and `make smoke-offline` run faster and report clean, readable execution metrics.
- [ ] Strict CI Barrier (DoD Rule 10): All workflow checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) remain 100% green on GitHub Actions.

## Out of scope
- Removing any test assertions, security checks, or dual-runtime Bun/Node parity checks.
- Loosening strict error classification, CAS fencing, or offline mode constraints.

## Testing plan
1. Benchmark baseline execution times for each job on GitHub Actions and local environment.
2. Implement caching, fixture optimization, and polling acceleration iteratively.
3. Compare before/after timings in PR summary table.
4. Verify all 5 CI checks pass green.

## Definition of Done
- [ ] Target duration benchmarks achieved in GitHub Actions runs.
- [ ] `README.md` and developer docs updated if new fast-path commands are added.
- [ ] Ticket index regenerated via `python3 docs/tickets/gen-index.py`.
