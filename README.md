# video-pipeline — design package (PDLC kick-off)

[![CI](https://github.com/szebest/video-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/szebest/video-pipeline/actions/workflows/ci.yml)

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

### 5. Useful commands
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
| `pnpm gen-video` | Generate deterministic synthetic video test fixtures |
| `pnpm dev-token` | Mint signed EdDSA JWTs and serve JWKS for local auth |

## Rules that never bend
Local-first (no external services at runtime, `make smoke-offline` must pass) · dual runtime (worker code passes under Node and Bun) · single-sourced contracts (`packages/job-contracts`, `keys.ts`, error codes, `.env.example`) · CAS transitions with `video_events` · errors classified at the throw site · prove with tests before claiming done. Details: `AGENTS.md`.
