# 48: Complete monorepo rebrand & package namespace unification (@vp/* -> @taitube/*, services, Docker & CLI)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#48](https://github.com/szebest/taitube-platform/issues/48) |
| Size | L |
| Blocked by | 01 — Repo skeleton |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD ADR-20 Monorepo topology](../SDD.md#adr-20-monorepo-topology-workspace-boundaries-and-contract-single-sourcing) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) |

**Status:** ready

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Ticket 85 note:** the rename sweep must also cover `@vp/intl`, `@vp/messages` and `@vp/intl-react`,
> introduced by [85](85-universal-intl-formatting-message-core.md).

> **Ticket 84 note:** the rename sweep must cover `@vp/result`, `@vp/validation` and `@vp/domain-rules`
> (all under `packages/universal/`), introduced by [84](84-result-typed-error-handling-shared-domain-rules.md).

## What to build

The generic project name `video-pipeline` and `@vp/*` package prefix served well during early architectural foundation phases. However, the platform has matured into a unified, full-stack video streaming and creator ecosystem powering the **Taitube** platform. Having backend packages named `@vp/*`, services named `video-pipeline`, and the frontend named `@taitube/web` creates namespace friction, cognitive dissonance, and fragmented developer tooling.

Executing this rebrand **early** (before starting remaining Phase 5 feature tickets) ensures that all subsequent tickets, imports, schemas, and tests are built directly against clean `@taitube/*` package names without needing future refactors.

This ticket delivers a **Comprehensive Monorepo Rebrand & Namespace Unification**:

1. **Every Monorepo Package & App Renamed to `@taitube/*`**:
   - **All Shared Packages & Domain Layers:**
     - `@vp/core` &rarr; `@taitube/core`
     - `@vp/adapters` &rarr; `@taitube/adapters`
     - `@vp/api-contracts` &rarr; `@taitube/api-contracts`
     - `@vp/api-client` &rarr; `@taitube/api-client`
     - `@vp/job-contracts` &rarr; `@taitube/job-contracts`
     - `@vp/db` &rarr; `@taitube/db`
     - `@vp/storage` &rarr; `@taitube/storage`
     - `@vp/ffmpeg` &rarr; `@taitube/ffmpeg`
     - `@vp/observability` &rarr; `@taitube/observability`
     - `@vp/events` &rarr; `@taitube/events`
     - `@vp/config` &rarr; `@taitube/config`
     - `@vp/errors` &rarr; `@taitube/errors`
     - `@vp/testing` &rarr; `@taitube/testing`
     - `@vp/tsconfig` &rarr; `@taitube/tsconfig`
   - **All Deployable Applications:**
     - `apps/api` &rarr; package name `@taitube/api`
     - `apps/worker` &rarr; package name `@taitube/worker`
     - `apps/web` &rarr; package name `@taitube/web`
   - **Root Workspace:**
     - Monorepo root `package.json` named `"taitube"`.
     - `tsconfig.base.json` path mappings updated from `@vp/*` to `@taitube/*`.
     - Update all `pnpm` workspace dependency declarations (`"@taitube/core": "workspace:*"`).

2. **Full Codebase Mentions & Import Refactoring**:
   - Replace every TypeScript import `from '@vp/...'` with `from '@taitube/...'` across all apps, packages, tests, and configuration files.
   - Zero occurrences of `@vp/` remaining anywhere in the repository source tree.
   - Update all code comments, log banners (e.g. `"Taitube Media Engine booting..."`), and class documentation.

3. **Services, Infrastructure & Container Rebranding**:
   - **Docker Compose:**
     - Project prefix set to `COMPOSE_PROJECT_NAME=taitube`.
     - Container and service names updated with explicit suffixes: `taitube-api`, `taitube-worker`, `taitube-postgres`, `taitube-redis`, `taitube-minio`.
     - Network name updated: `taitube-network`.
   - **OpenTelemetry & Observability:**
     - Service names in traces and metrics: `service.name: taitube-api`, `service.name: taitube-worker`, `service.namespace: taitube`.
     - Pino loggers initialized with name `taitube-api` / `taitube-worker`.
   - **BullMQ Queue Namespace & Admin UI:**
     - BullMQ queue names prefixed with `taitube:` (e.g. `taitube:transcode-1080p`, `taitube:probe`).
     - Bull Board dashboard title set to `"Taitube Queue Hub"`.
   - **Redis Key Namespaces:**
     - Cache key prefixes updated to `taitube:views:...`, `taitube:search:...`, `taitube:channel:...`.
   - **OpenAPI & Developer Portal:**
     - Fastify Swagger / Scalar documentation title updated to `"Taitube Media Platform API"`.
     - OpenAPI spec metadata, info title, and server descriptions updated to Taitube.

4. **Unified Developer CLI (`taitube`)**:
   - High-ergonomics `./bin/taitube` (POSIX shell) and `./bin/taitube.ps1` (PowerShell) convenience CLI:
     - `taitube up`: Launches the local container infrastructure.
     - `taitube dev`: Starts the API, BullMQ worker, and web frontend concurrently.
     - `taitube test`: Runs the dual-runtime test suite (`vitest` + `bun test`).
     - `taitube smoke`: Executes the end-to-end smoke test suite.
     - `taitube seed`: Seeds rich demo data (channels, categories, sample videos, playlists, comments).
   - Linked as a root script in `package.json`: `"taitube": "./bin/taitube"`.

## Acceptance criteria

- [ ] Every package in `packages/`, `core/`, and `adapters/` has its `package.json` name updated to `@taitube/*`.
- [ ] Applications named `@taitube/api`, `@taitube/worker`, and `@taitube/web`.
- [ ] Root workspace `package.json` named `"taitube"`, and `tsconfig.base.json` path mappings updated to `@taitube/*`.
- [ ] Automated verification: `git grep "@vp/"` returns zero matches across all `.ts`, `.tsx`, and `.json` files.
- [ ] All code imports updated to `@taitube/*` with zero broken dependencies.
- [ ] Docker Compose updated: `COMPOSE_PROJECT_NAME=taitube` with `taitube-*` containers and network.
- [ ] OpenTelemetry and Pino logger service names set to `taitube-api` and `taitube-worker`.
- [ ] BullMQ queues prefixed with `taitube:` and Bull Board titled `"Taitube Queue Hub"`.
- [ ] Redis keys updated to `taitube:*` namespace.
- [ ] OpenAPI documentation title updated to `"Taitube Media Platform API"`.
- [ ] `./bin/taitube` and `./bin/taitube.ps1` CLI scripts implemented and functional.
- [ ] Strict quality & verification gates:
  - `pnpm typecheck` passes with zero errors across all workspaces under `@taitube/*`.
  - `pnpm test` (vitest) and `bun test` pass 100% of tests.
  - `pnpm lint` / Biome check passes with zero errors.
  - `make smoke-offline` (or `pnpm taitube smoke`) executes and passes cleanly.

## Out of scope

- Renaming the physical root directory path on the local developer machine (to avoid disrupting existing git working trees or clone paths).

## Notes for the implementer

- **Systematic Search & Replace:** Execute replacements package by package. Start with `@vp/tsconfig` and `@vp/config`, then `@vp/core`, `@vp/adapters`, and outward to `apps/api` and `apps/worker`.
- **Git Rename Preservation:** Git history is preserved automatically because file paths inside packages remain identical; only `package.json` names, `tsconfig` paths, and imports are updated.
- **Backward-Compatible Env Aliases:** In `packages/config`, maintain fallback support for legacy `VP_*` environment variables so existing `.env` files continue to function seamlessly.

## Testing plan

- Namespace assertion: Run `git grep "@vp/"` and assert zero hits in codebase files.
- Monorepo build assertion: Run `pnpm -r build` or `pnpm typecheck` and verify every package resolves `@taitube/*` types.
- Dual runtime test: Run `pnpm test` and `bun test` to verify complete test pass under new imports.
- CLI verification: Execute `./bin/taitube help` and `./bin/taitube up`.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [ ] All subsequent tickets (`docs/tickets/36-78`) updated to reference `@taitube/*` packages, `taitube-*` services, `taitube:` queue/Redis namespaces, and the unified `taitube` CLI.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `AGENTS.md`, `CONTEXT.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
