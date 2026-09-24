# Branch Protection Configuration for `main`

To satisfy the quality gates and SDD invariants (SDD §2.3, §15.1, ADR-01), the `main` branch must enforce the following branch protection rules or repository ruleset:

## Required Status Checks
The following CI jobs from `.github/workflows/ci.yml` MUST pass before merging:

1. `lint-typecheck` — Biome linter + formatter check and Turborepo TypeScript compilation across all packages and apps.
2. `unit` — Vitest unit test suite executed under Node 24 LTS.
3. `unit-bun` — Bun 1.4 unit test suite executed across `apps/worker` and `packages/*`, enforcing dual-runtime parity and runtime neutrality (forbidding `Bun.*` APIs in worker code).
4. `integration` — Integration tests running against real service containers (`postgres:16-alpine`, `redis:7-alpine`, `cgr.dev/chainguard/minio`), verifying container connectivity (`psql`, `redis-cli PING`, `mc ls`), infrastructure smoke test (`infra/compose/test.sh`), and `pnpm test:integration`.

## Branch Protection Rules
- **Require a pull request before merging**: Enabled
- **Require status checks to pass before merging**: Enabled
  - Require branches to be up to date before merging: Enabled
  - Status checks that must pass: `lint-typecheck`, `unit`, `unit-bun`, `integration`
- **Do not allow bypassing the above settings**: Enabled
