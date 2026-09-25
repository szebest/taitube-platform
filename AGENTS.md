# AGENTS.md — video-pipeline

Instructions for any coding agent (Codex, Gemini CLI, Cursor, Copilot, OpenCode, Claude Code via `CLAUDE.md`) working in this repository.

---

## What this repo is
An asynchronous video ingestion, transcoding, and streaming platform: Fastify API (Node 24), BullMQ workers (Bun 1.4 / Node 24 dual-runtime), PostgreSQL + Drizzle, Redis, S3-compatible storage (MinIO locally, Cloudflare R2 in cloud), FFmpeg, KEDA autoscaling, and k6 load tests. Read `docs/PRD.md` for requirements and `docs/SDD.md` for the system design — **but only the sections a ticket links to**; the SDD is comprehensive by design.

### Which runtime runs what

| What | Runtime | Why |
|---|---|---|
| API in production | Node 24 | OpenTelemetry auto-instrumentation needs Node's module hooks (`--import ./dist/instrument.js`) |
| Worker in production | Bun 1.4 (`oven/bun:1.4-slim`) by default, Node 24 from an image built with `--build-arg WORKER_RUNTIME=node` | dual runtime, rule 2; the build arg picks the image stage, and the Bun image has no Node |
| Repo scripts, CLIs, `pnpm db:migrate` / `pnpm db:seed`, the e2e runner | `tsx` | Node parity with production for migrate and seed, and CI installs Bun only where `bun test` runs; the cost is about 150 ms of startup (`dev-token help` 0.19 s against Bun's 0.04 s) |
| Unit and architecture specs | vitest | `vi.mock(import())`, fake timers, `restoreMocks`, a jsdom run proving a universal package works in a browser (`vitest.jsdom.config.ts`), and the JSON reporter the CI budget reads |
| Worker and package specs, a second time | `bun test` (`pnpm test:bun`) | the dual-runtime proof |

`zero-matches` fails on a `bun <path>.ts` script in `package.json`, the `Makefile` or `.github`, and `ci-shape` on a CI job other than `unit-bun` that sets up Bun.

---

## How work is organised
- Work items are tracer-bullet tickets in `docs/tickets/<NN>-<slug>.md`. Use the `vp-work-ticket` skill to pick one up.
- Numbering represents dependency order, not priority. Never start a ticket whose blockers are not `done`.
- The frontier is computed: [docs/tickets/README.md#frontier](docs/tickets/README.md#frontier) lists every ticket whose blockers are done and which nobody has started. Pick from it.
- Ticket status lives in the ticket's `**Status:**` line; run `python3 docs/tickets/gen-index.py` after changing it.

---

## Core Non-Negotiable Rules

1. **Local-first (PRD G11, SDD P9):** No runtime dependency on any external service; `.env.example` stays all-local; nothing phones home; `make smoke-offline` must pass. See [docs/LOCAL_FIRST.md](docs/LOCAL_FIRST.md).
2. **Dual runtime parity:** Worker code and shared packages must execute interchangeably and pass tests under `vitest` and `bun test`; no `Bun.*` proprietary APIs in worker source. See [docs/standards/testing.md](docs/standards/testing.md).
3. **Contracts are single-sourced:** Job payloads and IDs in `packages/server/job-contracts`, object keys in `packages/server/storage/src/keys.ts`, error codes in `packages/universal/errors` (SDD §6.2), environment config in `packages/server/env-schema` mirrored by `.env.example`. The schema is closed: every key the deployables read, and every key compose, the k8s base, CI and `make` hand them, is declared there (`env-key-closure.test.ts`). `process.env` is read once, at `apps/*/src/main.ts`, through `loadEnv()` in `packages/server/config`, and shaped by `toAppConfig()` into the `AppConfig` value everything else takes. No secret-shaped key carries a default. Changing one requires updating `docs/SDD.md` in the same PR.
4. **Dependency inversion (Hexagonal Architecture):** Concrete SDKs (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`) are imported in exactly two places: `packages/server/adapters/**` and `packages/server/db/` (schema, client, migrations — it owns the Drizzle vocabulary the postgres adapter queries through). Both deployables compose one `Container` (`@vp/composition`, SDD ADR-25): `registerAdapters(c, config)` in `@vp/adapters` is the only switch between the in-memory and external families, `apps/api/src/composition/services.module.ts` and `apps/worker/src/composition/stages.module.ts` register the rest, and `@vp/adapters` is imported from nowhere else. Dependencies are total: a service or stage never constructs or defaults a collaborator it was not handed. Domain logic and routes depend on abstract class ports in `@vp/core/ports` and repository interfaces in `@vp/core/repositories`. See [ARCHITECTURE.md §6](ARCHITECTURE.md), which is the authority if this rule and it ever disagree.
5. **Modular repositories & file length discipline:** Every repository implementation must live in its own dedicated file inside a `repositories/` subfolder. Target <= 250 lines (strict ceiling: 400 lines / 10 KB per file). In-memory test doubles encapsulate their own state with `.clear()`. See [docs/standards/file-discipline.md](docs/standards/file-discipline.md).
6. **State durability via CAS & fencing:** State changes go through the Compare-and-Set helper that also atomically appends `video_events`; worker commits use monotonic fencing tokens (`vp-postgres-cas-fencing`).
7. **Errors classified at throw site:** Classify errors as `PermanentError` vs `TransientError` from `@vp/errors` (ADR-18).
8. **Declarative authorization & zero hand-checked permissions:** Centralized in `@vp/permissions` evaluated via CASL rules. Never hand-check user IDs or roles inline. See [docs/standards/authorization.md](docs/standards/authorization.md).
9. **Prove, don't claim:** Run typecheck, lint, and relevant test suites and paste output before declaring work done (`verification-before-completion`). See [docs/standards/testing.md](docs/standards/testing.md).
10. **Branch protection & squash-only PR merges:** Direct pushes to `main` are blocked. Work on `ticket/<NN>-<slug>` or `<type>/<slug>` branches, require PR approval and green CI checks, and squash merge (`NN: <ticket title> (#<pr_number>)`). See [docs/standards/git-workflow.md](docs/standards/git-workflow.md).
11. **Enforce optimal execution & zero-waste workflows:** All developer setups, Docker builds, CI jobs, test suites, and scripts must be engineered for speed and caching. Performance or cycle-time regressions are treated as blocking defects.
12. **Mandatory 1:1 test file correspondence:** Every single source file, helper, util, rule, normalizer, or adapter MUST map to at least one dedicated test file matching its name; grouping tests for multiple separate source files into a single bundled test file is a strict architectural violation. See [docs/standards/testing.md](docs/standards/testing.md).
13. **Package tiers & dependency layers:** A shared package's **directory** declares where its code may run — `packages/universal/` (browser and server), `packages/server/` (Node/Bun only), `packages/client/` (browser only) — and `vp.layer` in its `package.json` declares which way its dependencies may point (strictly down; a same-layer edge is a violation). `server` and `client` never see each other, so no path leads from `apps/web` to a server package. `pnpm boundaries` runs ahead of `pnpm build` and `pnpm typecheck` and fails on a violation. See [packages/AGENTS.md](packages/AGENTS.md).

14. **Results at the domain seam:** domain code *returns* its failures, it does not throw them. Rules in
    `@vp/validation` (input only) and `@vp/domain-rules` (input plus an entity) are pure and return
    `Result<T, Failure>` from `@vp/result`; services compose them and return a `Result` whose error union is
    **inferred**; only two places unwrap one - `sendResult` in `apps/api/src/routes/` and `instrument` in
    `apps/worker/src/composition/stages.module.ts`, which converts through `RETRY_CLASS`. `catch` belongs to `tryCatch`/`fromPromise` at the
    exact line an SDK is called. The discriminant is the existing `ErrorCode`: never a second vocabulary.
    See [docs/standards/error-handling.md](docs/standards/error-handling.md) and [SDD ADR-24](docs/SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides).

---

## Area-Specific Agent Instructions (Directory Index)

Agents working in a specific package or app MUST follow its dedicated `AGENTS.md`:

- **Frontend Client (`apps/web`, client/T4):** [apps/web/AGENTS.md](apps/web/AGENTS.md)  
  *React 18 + Create React App 5 + RTK Query + Bootstrap today; declarative `<Can>` authorization, all HTTP through `@vp/api-client`. The React 19 / TanStack / Tailwind stack is target state owned by tickets 49–75.*
- **Backend API (`apps/api`):** [apps/api/AGENTS.md](apps/api/AGENTS.md)  
  *Fastify 5, route plugins over `app.services`, deep domain services, one container composed in `composition/`.*
- **Worker Runtime (`apps/worker`):** [apps/worker/AGENTS.md](apps/worker/AGENTS.md)  
  *BullMQ pipeline stages, FFmpeg transcoding, dual-runtime Node/Bun, fencing tokens, temp dir cleanup.*
- **Core Domain (`@vp/core`, server/T3):** [packages/server/core/AGENTS.md](packages/server/core/AGENTS.md)  
  *Zero-dependency abstract ports, repository interfaces, domain entities and policy.*
- **Adapters (`@vp/adapters`, server/T4):** [packages/server/adapters/AGENTS.md](packages/server/adapters/AGENTS.md)  
  *Postgres, Redis, S3, BullMQ concrete adapters and autonomous in-memory test doubles.*

Shared packages live under `packages/<tier>/`, where the directory **is** the tier.
**[packages/AGENTS.md](packages/AGENTS.md)** is the authoritative reference for tiers, layers and the
import rules; each tier directory has its own: [universal](packages/universal/AGENTS.md) · [server](packages/server/AGENTS.md) · [client](packages/client/AGENTS.md).

- **`packages/universal/` — runs in a browser and on a server:**  
  [api-contracts](packages/universal/api-contracts/AGENTS.md) · [domain](packages/universal/domain/AGENTS.md) · [domain-rules](packages/universal/domain-rules/AGENTS.md) · [errors](packages/universal/errors/AGENTS.md) · [intl](packages/universal/intl/AGENTS.md) · [messages](packages/universal/messages/AGENTS.md) · [pagination](packages/universal/pagination/AGENTS.md) · [permissions](packages/universal/permissions/AGENTS.md) · [result](packages/universal/result/AGENTS.md) · [tsconfig](packages/universal/tsconfig/AGENTS.md) · [validation](packages/universal/validation/AGENTS.md)
- **`packages/client/` — browser only:**  
  [api-client](packages/client/api-client/AGENTS.md) · [intl-react](packages/client/intl-react/AGENTS.md)
- **`packages/server/` — Node/Bun only:**  
  [adapters](packages/server/adapters/AGENTS.md) · [composition](packages/server/composition/AGENTS.md) · [concurrency](packages/server/concurrency/AGENTS.md) · [config](packages/server/config/AGENTS.md) · [core](packages/server/core/AGENTS.md) · [db](packages/server/db/AGENTS.md) · [env-schema](packages/server/env-schema/AGENTS.md) · [events](packages/server/events/AGENTS.md) · [ffmpeg](packages/server/ffmpeg/AGENTS.md) · [job-contracts](packages/server/job-contracts/AGENTS.md) · [logger](packages/server/logger/AGENTS.md) · [observability](packages/server/observability/AGENTS.md) · [storage](packages/server/storage/AGENTS.md) · [testing](packages/server/testing/AGENTS.md)  
  CLI packages: [compose-autoscaler](packages/server/compose-autoscaler/AGENTS.md) · [dev-token](packages/server/dev-token/AGENTS.md) · [gen-video](packages/server/gen-video/AGENTS.md) · [upload-client](packages/server/upload-client/AGENTS.md)
- **Infrastructure & Cloud Topologies (`infra`):** [infra/AGENTS.md](infra/AGENTS.md)  
  [infra/compose](infra/compose/AGENTS.md) · [infra/k8s](infra/k8s/AGENTS.md) · [infra/terraform](infra/terraform/AGENTS.md) · `infra/observability/` (Grafana dashboards, Prometheus alert rules)
- **Developer assets (`tools`):** [tools/AGENTS.md](tools/AGENTS.md)  
  *`chaos/` and `hls-test-page/` only — anything with a `package.json` is a package under `packages/<tier>/`.*

---

## Documentation & Standards Index

- **Hexagonal Architecture & Boundaries:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Testing Standards & Strategy:** [docs/standards/testing.md](docs/standards/testing.md)
- **Git Workflow & Pull Requests:** [docs/standards/git-workflow.md](docs/standards/git-workflow.md)
- **File Discipline & Sizing:** [docs/standards/file-discipline.md](docs/standards/file-discipline.md)
- **Package Boundaries — tiers & layers:** [packages/AGENTS.md](packages/AGENTS.md)
- **Error handling, `Result` at the domain seam:** [docs/standards/error-handling.md](docs/standards/error-handling.md)
- **Formatting & i18n, `Intl` and the catalogues:** [docs/standards/formatting-and-i18n.md](docs/standards/formatting-and-i18n.md)
- **Machine-enforced invariants:** [ARCHITECTURE.md §6](ARCHITECTURE.md) · `tests/architecture/`
- **Declarative Authorization:** [docs/standards/authorization.md](docs/standards/authorization.md)
- **Domain Glossary:** [CONTEXT.md](CONTEXT.md)
- **Local-First Guide:** [docs/LOCAL_FIRST.md](docs/LOCAL_FIRST.md)
- **Issue Tracker Conventions:** [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)

---

## Global Commands Quick Reference

`make up` (infra) · `make up-all` (everything) · `make smoke` · `make smoke-offline` · `pnpm dev` · `pnpm test` · `pnpm test:bun` · `pnpm test:architecture` (the invariant suite) · `pnpm lint` · `pnpm typecheck` · `pnpm boundaries` (tiers, layers, `CLAUDE.md` symlinks) · `pnpm sync:claude` · `pnpm gen:contracts` (the committed OpenAPI document) · `make k3d-up && make k3d-deploy` (Kubernetes) · `make e2e` (acceptance suite; `E2E_REDUCED=true` for the CI set).
