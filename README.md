# video-pipeline — design package (PDLC kick-off)

[![CI](https://github.com/szebest/video-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/szebest/video-pipeline/actions/workflows/ci.yml)

Everything needed to start building the asynchronous video ingestion & HLS transcoding backend, in one tree laid out like the future repository. Nothing here is code yet — it is the specification, the work breakdown, and the agent tooling that turns the specification into code.

| Path | What it is | Latest version |
|---|---|---|
| `docs/PRD.md` | Product Requirements Document (goals G1–G11 incl. **local-first**, user stories, FR-1…19, NFR/SLOs, risks, open questions) | v1.0 + local-first update |
| `docs/SDD.md` | System Design Document & Implementation Blueprint (architecture, 18 ADRs with ranked alternatives, DDL, API, storage, FFmpeg, queue/worker deep-dive, SSE, security, deployment & cost, autoscaling, observability, load/chaos plan, repo layout, env, fact sheet, roadmap) | v1.0 + P9 local-first / offline mode |
| `docs/LOCAL_FIRST.md` | Local-first and offline execution guide (zero external dependencies, zero egress) | v1.0 |
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

### Run everything in Docker (Phase 1 Walking Skeleton)

Someone with only Docker installed can clone the repository and run the full stack and end-to-end smoke test without installing Node, Bun, or FFmpeg locally:

```bash
# 1. Clone and set up environment contract
cp .env.example .env

# 2. Start full stack (Infra + Migrations + Fastify API + Worker stages)
make up-all

# 3. Run end-to-end smoke test (uploads fixture s15, waits for READY, verifies HLS playback)
make smoke

# 4. (Optional) Open the HLS test page with tools profile
docker compose --profile tools -f infra/compose/docker-compose.yml up -d
# Open http://localhost:8080 in your browser
```

#### Docker Image Specifications & Sizes
- **API (`vp-api`)**: Node 24 slim, multi-stage build, non-root user (`appuser:10001`), `tini` PID 1, read-only root FS, exposed on ports 3000 and 9464. Image size: ~225 MB.
- **Worker (`vp-worker`)**: Dual-runtime switchable via `WORKER_RUNTIME` build arg, FFmpeg + tini, non-root user (`10001`), read-only root FS with tmpfs for `/tmp/vp`.
  - **Bun variant (`WORKER_RUNTIME=bun`)**: ~240 MB.
  - **Node variant (`WORKER_RUNTIME=node`)**: ~310 MB.

### Local development

#### 1. Start local infrastructure
```bash
# Copy local environment contract
cp .env.example .env

# Start Postgres, Redis (noeviction + AOF), MinIO (raw + public buckets, ILM rules, anonymous read)
make up

# Verify Redis and storage health
make check-redis
make smoke-infra
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

### 3. Try it locally (Phase 0 Dev Tooling)

#### Generate Deterministic Video Fixtures
```bash
# Generate fast fixture set into tests/fixtures (< 10s)
pnpm gen-video

# Verify generated fixtures against manifest (ffprobe stream analysis + checksums)
pnpm gen-video --check

# Generate a single fixture or include slow sets (m10, l30, over-duration)
pnpm gen-video --only s15
pnpm gen-video --include-slow
```

#### Mint Offline Dev JWTs (EdDSA / Ed25519)
```bash
# Mint an admin JWT with 8-hour TTL
pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin --ttl 8h

# Output JWKS public keys JSON (deterministic Ed25519 keypair)
pnpm dev-token jwks

# Run standalone local JWKS server on port 3001
pnpm dev-token serve --port 3001
```

#### HLS Player & Real-Time SSE Monitor
Open `tools/hls-test-page/index.html` in any browser (uses vendored `hls.js`, 100% offline & local-first):
- **Play Public Sample**: Tests adaptive bitrate HLS playback.
- **Simulate Mock SSE**: Tests real-time transcode progress bars (`1080p`, `720p`, `480p`, overall) using `SseEvent` schema (SDD §20).
- **Subscribe SSE**: Connects to `GET /v1/videos/:id/events` when the API is running.

#### Resumable Multipart Upload Client (`@vp/upload-client`)
For files above 100 MB (up to 4 GB+), uploads use S3 multipart direct-to-storage with concurrency 4 (Ticket 11):
```bash
# Upload a large file (single PUT for <= 100 MB, multipart with 8-64 MiB parts for > 100 MB)
pnpm upload-client path/to/video.mp4 --title "My Large Video"

# Resume an interrupted upload from stored parts (backed by S3 ListParts)
pnpm upload-client --resume <uploadId> path/to/video.mp4

# Abort an incomplete upload in storage and mark video ABANDONED
pnpm upload-client --abort <uploadId>
```

### 4. First video end-to-end (Walking Skeleton)

Run the full end-to-end upload and transcoding flow locally:

1. **Start the API and workers:**
   ```bash
   # Terminal 1: Fastify API
   pnpm --filter @vp/api dev

   # Terminal 2: Probe Worker
   WORKER_STAGE=probe pnpm --filter @vp/worker dev

   # Terminal 3: Transcode Worker
   WORKER_STAGE=transcode-720p pnpm --filter @vp/worker dev

   # Terminal 4: Package Worker
   WORKER_STAGE=package pnpm --filter @vp/worker dev

   # Terminal 5: Notify Worker
   WORKER_STAGE=notify pnpm --filter @vp/worker dev
   ```

2. **Upload a video:**
   ```bash
   ./scripts/upload.sh tests/fixtures/s60.mp4 "My Test Video"
   ```

3. **Verify and play:**
   - Query the video via API:
     ```bash
     curl -H "Authorization: Bearer $(pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin)" http://localhost:3000/v1/videos/<VIDEO_ID>
     ```
   - Copy the `playbackUrl` (`http://localhost:9000/public/videos/<VIDEO_ID>/hls/master.m3u8`).
   - Open `tools/hls-test-page/index.html` in your browser, paste the URL, and press **Load & Play**.

### 5. Operations & Queue Dashboard (Bull Board)

An operator dashboard powered by Bull Board is mounted at `/admin/queues` under the API (Ticket 10):
- **All Queues Visible:** Displays `probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`, `housekeeping`, and `dlq`.
- **Job Inspection & Control:** Real-time visibility into waiting, active, completed, delayed, and failed jobs. Operators can inspect job payloads, errors, pause/resume queues, and retry jobs.
- **Admin Authorization:**
  - Provide an admin JWT: `Authorization: Bearer <token>` (minted via `pnpm dev-token mint --role admin`).
  - Or provide the constant-time admin secret header: `x-admin-token: <ADMIN_TOKEN>`.
  - Non-admin callers receive RFC 9457 `401 Unauthorized` or `403 Forbidden`.

### 6. Observability Stack (Prometheus, Grafana, Tempo, Loki, OTel Collector, Alertmanager)

A complete local observability stack is available as a Docker Compose profile (SDD §12.1, §13, ADR-14, Ticket 21):

```bash
# 1. Start full stack with observability profile enabled
docker compose -f infra/compose/docker-compose.yml --profile observability up -d

# Or using Makefile:
make obs-up

# 2. Verify all targets and components with automated health check:
make obs-check
```

#### Endpoints
- **Prometheus** (`http://localhost:9090`): Scrapes API (`:9464`) and every worker stage (`:9464`) every 5 s.
- **Grafana** (`http://localhost:3001`): Pre-provisioned with Prometheus, Tempo, and Loki data sources, plus an automatically wired `video-pipeline` dashboards folder (`observability/dashboards/`). Default login: `admin` / `admin`.
- **Tempo** (`http://localhost:3200`): Distributed tracing receiver (OTLP gRPC on `4317` and HTTP on `4318`).
- **Loki** (`http://localhost:3100`): Log aggregation receiver.
- **OTel Collector** (`http://localhost:4318`): Accepts standard OTLP HTTP spans and logs, routing traces to Tempo and logs to Loki.
- **Alertmanager** (`http://localhost:9093`): Mounted with `observability/alerts/` rules directory and webhook routing.

### 7. Useful commands
| Command | Description |
|---|---|
| `make up` | Start local Postgres, Redis, MinIO with buckets initialized |
| `make up-all` | Start full stack (infra, migrations, API, all worker stages) |
| `make obs-up` | Start local observability profile (Prometheus, Grafana, Tempo, Loki, OTel, Alertmanager) |
| `make obs-down` | Stop local observability profile |
| `make obs-check` | Verify Prometheus targets UP and datasources healthy |
| `make down` | Stop local infrastructure containers |
| `make logs` | Follow compose logs |
| `make psql` | Open psql shell inside Postgres |
| `make redis-cli` | Open redis-cli shell inside Redis |
| `make mc` | Run MinIO client |
| `make check-redis` | Verify BullMQ Redis constraints (`noeviction` + `appendonly`) |
| `make smoke` | Run local infrastructure smoke tests |
| `make smoke-offline` | Run offline smoke tests with zero egress |
| `make e2e` | Run Phase 2 pipeline E2E acceptance suite |
| `make nuke` | Teardown containers and destroy persistent volumes |
| `pnpm dev` | Run monorepo in development mode via Turborepo |
| `pnpm build` | Build all workspace packages with Turborepo |
| `pnpm typecheck` | Run TypeScript typechecking across all packages |
| `pnpm lint` | Run Biome linter across the repository |
| `pnpm format` | Auto-format codebase with Biome |
| `pnpm test` | Run Vitest tests across all packages |
| `pnpm test:bun` | Run worker smoke tests with Bun test runner |
| `pnpm gen-video` | Generate deterministic synthetic video test fixtures |
| `pnpm dev-token` | Mint signed EdDSA JWTs and serve JWKS for local auth |

## Rules that never bend
Local-first (no external services at runtime, `make smoke-offline` must pass) · dual runtime (worker code passes under Node and Bun) · single-sourced contracts (`packages/job-contracts`, `keys.ts`, error codes, `.env.example`) · CAS transitions with `video_events` · errors classified at the throw site · prove with tests before claiming done. Details: `AGENTS.md`.
