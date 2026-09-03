# 02: CI with real service containers, Node **and** Bun test jobs, Renovate

| Field | Value |
|---|---|
| Phase | 0 — Bootstrap |
| Size | M |
| Blocked by | 01 — Repo skeleton + local infrastructure |
| Blocks | 08 |
| Spec | [SDD §15.1 workflows](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §2.3 Runtime split guard-rail](../SDD.md#23-runtime-split-why-two-runtimes) · [SDD §11 Supply chain](../SDD.md#11-security) · [SDD §17 Fact sheet (GitHub)](../SDD.md#17-fact-sheet-verified-2026-09-03) |

**Status:** ready-for-agent

## What to build
Every pull request proves the repo builds, lints and passes unit + integration tests against real Postgres/Redis/MinIO, and proves worker code runs under both Bun and Node. Dependency updates arrive weekly, grouped, with actions pinned by digest.

## Acceptance criteria
- [ ] `ci.yml` runs on PR and `main`: `lint-typecheck`, `unit` (Node 24), `unit-bun` (worker + packages via `bun test`), `integration` (service containers `postgres:16-alpine`, `redis:7-alpine`, `minio/minio` + bucket init step, `ffmpeg` installed); total wall-clock < 8 min with pnpm store + Turborepo caching.
- [ ] A deliberate Bun-only construct (e.g. `Bun.spawn`) placed in worker code fails `unit-bun` while `unit` stays green, then is removed — the parity gate is demonstrated in the PR.
- [ ] Integration job can `psql`, `redis-cli PING` and `mc ls` the service containers; `infra/compose/test.sh` from 01 passes there.
- [ ] `renovate.json`: weekly, grouped minor/patch, lockfile maintenance, GitHub Actions pinned by digest; config validates.
- [ ] Branch protection on `main` requires the CI checks; PR template contains the ticket checklist from `docs/tickets/README.md`.

## Out of scope
Image build workflow (08), nightly load smoke (28).

## Notes for the implementer
- Fixtures from 03 will be needed by later integration tests; leave a cache step keyed by the fixture manifest hash ready to enable.
- Repo is assumed public (free Actions minutes and free GHCR) — confirm; if private, budget 2 000 min/month.

## Testing plan
The workflow itself on a branch; one green run and one intentionally red run recorded in the PR.

## Open questions
- None.

## Definition of Done
- [ ] Required checks configured; README badge; Renovate opens its onboarding PR.
