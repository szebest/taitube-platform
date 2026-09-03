# video-pipeline — design package (PDLC kick-off)

Everything needed to start building the asynchronous video ingestion & HLS transcoding backend, in one tree laid out like the future repository. Nothing here is code yet — it is the specification, the work breakdown, and the agent tooling that turns the specification into code.

| Path | What it is | Latest version |
|---|---|---|
| `docs/PRD.md` | Product Requirements Document (goals G1–G11 incl. **local-first**, user stories, FR-1…19, NFR/SLOs, risks, open questions) | v1.0 + local-first update |
| `docs/SDD.md` | System Design Document & Implementation Blueprint (architecture, 18 ADRs with ranked alternatives, DDL, API, storage, FFmpeg, queue/worker deep-dive, SSE, security, deployment & cost, autoscaling, observability, load/chaos plan, repo layout, env, fact sheet, roadmap) | v1.0 + P9 local-first / offline mode |
| `docs/diagrams/` | Rendered architecture diagram and ticket dependency graph (PNG) | — |
| `docs/tickets/` | 35 tracer-bullet tickets (`NN-slug.md`), index with status board / dependency graph / parallel lanes (`README.md`), and the generator (`gen-index.py`) | — |
| `docs/agents/` | Config the workflow skills read: where tickets live (`issue-tracker.md`), how to use glossary/ADRs (`domain.md`) | — |
| `.env.example` | The single environment contract for API and workers (all-local defaults; cloud values commented) | — |
| `AGENTS.md` / `CLAUDE.md` | Instructions every coding agent reads (CLAUDE.md just includes AGENTS.md) | — |
| `.agents/skills/` | 58 portable Agent Skills, pre-installed (8 project-specific `vp-*`, 50 curated from open-source libraries); licenses in `.agents/skills/.licenses-video-pipeline-skills/` | — |
| `skills-bundle/` | Skill tooling: `install.py` (any agent, profiles, strict mode), `validate.py`, `manifest.json`, `README.md` (which skill for which ticket), `PORTABILITY.md`, `ATTRIBUTION.md` | — |

## Quick start

### Prerequisites
- Node.js 24 LTS (`node -v`)
- Bun 1.4+ (`bun -v`)
- pnpm 10 (`npm i -g pnpm@10`)
- Docker & Docker Compose (`docker compose version`)

### 1. Start local infrastructure
```bash
# Copy local environment contract
cp .env.example .env

# Start Postgres, Redis (noeviction + AOF), MinIO (raw + public buckets, ILM rules, anonymous read)
make up

# Verify Redis and storage health
make check-redis
make smoke
```

### 2. Install dependencies & verify build
```bash
# Install dependencies across all workspace packages
pnpm install

# Typecheck, lint, and run tests across the monorepo
pnpm typecheck
pnpm lint
pnpm test

# Verify worker runtime parity with Bun
pnpm test:bun
```

### 3. Useful commands
| Command | Description |
|---|---|
| `make up` | Start local Postgres, Redis, MinIO with buckets initialized |
| `make down` | Stop local infrastructure containers |
| `make logs` | Follow compose logs |
| `make psql` | Open psql shell inside Postgres |
| `make redis-cli` | Open redis-cli shell inside Redis |
| `make mc` | Run MinIO client |
| `make check-redis` | Verify BullMQ Redis constraints (`noeviction` + `appendonly`) |
| `make smoke` | Run local infrastructure smoke tests |
| `make nuke` | Teardown containers and destroy persistent volumes |
| `pnpm dev` | Run monorepo in development mode via Turborepo |
| `pnpm build` | Build all workspace packages with Turborepo |
| `pnpm typecheck` | Run TypeScript typechecking across all packages |
| `pnpm lint` | Run Biome linter across the repository |
| `pnpm format` | Auto-format codebase with Biome |
| `pnpm test` | Run Vitest tests across all packages |
| `pnpm test:bun` | Run worker smoke tests with Bun test runner |

## Rules that never bend
Local-first (no external services at runtime, `make smoke-offline` must pass) · dual runtime (worker code passes under Node and Bun) · single-sourced contracts (`packages/job-contracts`, `keys.ts`, error codes, `.env.example`) · CAS transitions with `video_events` · errors classified at the throw site · prove with tests before claiming done. Details: `AGENTS.md`.
