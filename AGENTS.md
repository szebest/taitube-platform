# AGENTS.md — video-pipeline

Instructions for any coding agent (Codex, Gemini CLI, Cursor, Copilot, OpenCode, Claude Code via `CLAUDE.md`) working in this repository.

---

## What this repo is
An asynchronous video ingestion, transcoding, and streaming platform: Fastify API (Node 24), BullMQ workers (Bun 1.4 / Node 24 dual-runtime), PostgreSQL + Drizzle, Redis, S3-compatible storage (MinIO locally, Cloudflare R2 in cloud), FFmpeg, KEDA autoscaling, and k6 load tests. Read `docs/PRD.md` for requirements and `docs/SDD.md` for the system design — **but only the sections a ticket links to**; the SDD is comprehensive by design.

---

## How work is organised
- Work items are tracer-bullet tickets in `docs/tickets/NN-slug.md`; the index `docs/tickets/README.md` shows the frontier (tickets whose blockers are done). Use the `vp-work-ticket` skill to pick one up.
- Numbering represents dependency order, not priority. Never start a ticket whose blockers are not `done`.
- **Frontier Priority Policy:** Tickets 79 (Offline smoke runner refactor & CI cleanup) and 80 (Full-spectrum developer experience, local dev setup & CI/CD pipeline acceleration) take absolute precedence over Phase 5 frontend tickets (`36`+). Complete Tickets 79 and 80 first to establish an ultra-fast local and CI foundation before starting frontend feature tickets.
- Ticket status lives in the ticket's `**Status:**` line; run `python3 docs/tickets/gen-index.py` after changing it.

---

## Core Non-Negotiable Rules

1. **Local-first (PRD G11, SDD P9):** No runtime dependency on any external service; `.env.example` stays all-local; nothing phones home; `make smoke-offline` must pass. See [docs/LOCAL_FIRST.md](docs/LOCAL_FIRST.md).
2. **Dual runtime parity:** Worker code and shared packages must execute interchangeably and pass tests under `vitest` and `bun test`; no `Bun.*` proprietary APIs in worker source. See [docs/standards/testing.md](docs/standards/testing.md).
3. **Contracts are single-sourced:** Job payloads and IDs in `packages/job-contracts`, object keys in `packages/storage/keys.ts`, error codes in `packages/errors` (SDD §6.2), environment config in `packages/config` mirrored by `.env.example`. Changing one requires updating `docs/SDD.md` in the same PR.
4. **Dependency inversion (Hexagonal Architecture):** Concrete SDKs (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`) must never be imported outside `adapters/` and composition roots (`apps/api/src/app.ts`, `apps/worker/src/runner.ts`). Domain logic and routes depend on abstract class ports in `@vp/core/ports` and repository interfaces in `@vp/core/repositories`. See [ARCHITECTURE.md](ARCHITECTURE.md).
5. **Modular repositories & file length discipline:** Every repository implementation must live in its own dedicated file inside a `repositories/` subfolder. Target <= 250 lines (strict ceiling: 400 lines / 10 KB per file). In-memory test doubles encapsulate their own state with `.clear()`. See [docs/standards/file-discipline.md](docs/standards/file-discipline.md).
6. **State durability via CAS & fencing:** State changes go through the Compare-and-Set helper that also atomically appends `video_events`; worker commits use monotonic fencing tokens (`vp-postgres-cas-fencing`).
7. **Errors classified at throw site:** Classify errors as `PermanentError` vs `TransientError` from `@vp/errors` (ADR-18).
8. **Declarative authorization & zero hand-checked permissions:** Centralized in `@vp/core/permissions` evaluated via CASL rules. Never hand-check user IDs or roles inline. See [docs/standards/authorization.md](docs/standards/authorization.md).
9. **Prove, don't claim:** Run typecheck, lint, and relevant test suites and paste output before declaring work done (`verification-before-completion`). See [docs/standards/testing.md](docs/standards/testing.md).
10. **Branch protection & squash-only PR merges:** Direct pushes to `main` are blocked. Work on `ticket/NN-slug` or `<type>/<slug>` branches, require PR approval and green CI checks, and squash merge (`NN: <ticket title> (#<pr_number>)`). See [docs/standards/git-workflow.md](docs/standards/git-workflow.md).
11. **Enforce optimal execution & zero-waste workflows:** All developer setups, Docker builds, CI jobs, test suites, and scripts must be engineered for speed and caching. Performance or cycle-time regressions are treated as blocking defects.

---

## Area-Specific Agent Instructions (Directory Index)

Agents working in a specific package or app MUST follow its dedicated `AGENTS.md`:

- **Frontend Client (`apps/web`):** [apps/web/AGENTS.md](apps/web/AGENTS.md)  
  *Headless UI, React 19, TanStack Router & Query, URL state (STS pattern), zero logic in JSX, skeleton placeholders.*
- **Backend API (`apps/api`):** [apps/api/AGENTS.md](apps/api/AGENTS.md)  
  *Fastify 5, thin route transport adapters, deep domain services (>1:1 ratio), HttpCacheService, Singleflight, SseHub.*
- **Worker Runtime (`apps/worker`):** [apps/worker/AGENTS.md](apps/worker/AGENTS.md)  
  *BullMQ pipeline stages, FFmpeg transcoding, dual-runtime Node/Bun, fencing tokens, temp dir cleanup.*
- **Core Domain (`core`):** [core/AGENTS.md](core/AGENTS.md)  
  *Zero-dependency abstract ports, repository interfaces, domain entities, pure CASL authorization engine.*
- **Adapters (`adapters`):** [adapters/AGENTS.md](adapters/AGENTS.md)  
  *Postgres, Redis, S3, BullMQ concrete adapters and autonomous in-memory test doubles.*
- **Shared Packages:**  
  [packages/config](packages/config/AGENTS.md) · [packages/db](packages/db/AGENTS.md) · [packages/errors](packages/errors/AGENTS.md) · [packages/events](packages/events/AGENTS.md) · [packages/ffmpeg](packages/ffmpeg/AGENTS.md) · [packages/job-contracts](packages/job-contracts/AGENTS.md) · [packages/observability](packages/observability/AGENTS.md) · [packages/storage](packages/storage/AGENTS.md) · [packages/testing](packages/testing/AGENTS.md) · [packages/tsconfig](packages/tsconfig/AGENTS.md)
- **Infrastructure & Cloud Topologies (`infra`):** [infra/AGENTS.md](infra/AGENTS.md)  
  [infra/compose](infra/compose/AGENTS.md) · [infra/k8s](infra/k8s/AGENTS.md) · [infra/terraform](infra/terraform/AGENTS.md)
- **Developer Tools (`tools`):** [tools/AGENTS.md](tools/AGENTS.md)  
  *dev-token, gen-video, upload-client, chaos, compose-autoscaler.*

---

## Documentation & Standards Index

- **Hexagonal Architecture & Boundaries:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Testing Standards & Strategy:** [docs/standards/testing.md](docs/standards/testing.md)
- **Git Workflow & Pull Requests:** [docs/standards/git-workflow.md](docs/standards/git-workflow.md)
- **File Discipline & Sizing:** [docs/standards/file-discipline.md](docs/standards/file-discipline.md)
- **Declarative Authorization:** [docs/standards/authorization.md](docs/standards/authorization.md)
- **Domain Glossary:** [CONTEXT.md](CONTEXT.md)
- **Local-First Guide:** [docs/LOCAL_FIRST.md](docs/LOCAL_FIRST.md)
- **Issue Tracker Conventions:** [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)

---

## Global Commands Quick Reference

`make up` (infra) · `make up-all` (everything) · `make smoke` · `make smoke-offline` · `pnpm dev` · `pnpm test` · `pnpm test:bun` · `pnpm lint` · `pnpm typecheck` · `make k3d-up && make k3d-deploy` (Kubernetes) · `make e2e` (acceptance suite).
