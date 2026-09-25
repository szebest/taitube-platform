# TaiTube Platform

[![CI](https://github.com/szebest/taitube-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/szebest/taitube-platform/actions/workflows/ci.yml)

TaiTube is an asynchronous video ingestion, processing and streaming platform: multipart uploads straight to
storage, keyframe-aligned multi-rendition HLS transcoding with FFmpeg, job coordination with BullMQ, SSE
progress events, and metrics, traces and logs.

It is a TypeScript monorepo built on ports and adapters, with workers that run on Node.js 24 and Bun 1.4, and it
runs offline with no external cloud dependency.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
- [Key Capabilities](#key-capabilities)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Local Development Setup](#local-development-setup)
- [End-to-End Workflow](#end-to-end-workflow)
- [Observability and Monitoring](#observability-and-monitoring)
- [Autoscaling](#autoscaling)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Available Commands](#available-commands)
- [Engineering Standards](#engineering-standards)
- [Documentation Index](#documentation-index)

---

## Architecture Overview

TaiTube decouples high-throughput API ingestion from resource-heavy video transcoding jobs through dedicated worker queues and object storage.

```
                  +----------------------------------------------+
                  |                 Client / Web                 |
                  +-------+------------------------------+-------+
                          |                              |
            1. Presigned  |                 3. Direct S3 |
               Upload URL |                    Multipart |
                          v                              v
                  +-------+----------+           +-------+----------+
                  |  Fastify API     |           |  S3 / MinIO      |
                  |  (Node.js 24)    |           |  Storage Bucket  |
                  +-------+----------+           +-------+----------+
                          |                              ^
             2. Enqueue   |                 4. Download  | 5. Upload HLS
                Jobs      v                    & Process |    & WebVTT
                  +-------+----------+                   |
                  |  Redis / BullMQ  +-------------------+
                  +-------+----------+
                          |
                          v
                  +-------+----------+
                  |  Worker Pipeline |  (Probe -> Transcode -> Package -> Notify)
                  |  (Bun / Node)    |
                  +------------------+
```

1. **Ingestion**: The client requests a presigned single-PUT or multipart upload URL from the API. Files stream directly to S3-compatible storage (MinIO locally, Cloudflare R2 in production) without passing video payload bytes through API server memory.
2. **Coordination**: Upload completion registers the video in PostgreSQL and dispatches a deterministic BullMQ job flow with parent-child dependencies.
3. **Transcoding Pipeline**:
   - `probe`: Validates container metadata, codec support, aspect ratios, and duration limits using `ffprobe`.
   - `transcode-1080p / 720p / 480p`: Parallel FFmpeg workers generate keyframe-aligned H.264 video and AAC audio TS segments.
   - `thumbnail`: Generates high-resolution poster frames and synchronized WebVTT scrub thumbnail sprite sheets.
   - `package`: Generates master HLS `.m3u8` playlists linking all processed renditions.
   - `notify`: Finalizes state transitions, updates read models, and publishes real-time SSE completion events.
4. **State and Durability**: All database state transitions execute through transactional Compare-and-Set (CAS) operations that append immutable audit records to `video_events` with worker fencing tokens to prevent zombie overwrites.

---

## Monorepo Structure

The monorepo is organized using `pnpm` workspaces and `Turborepo`:

```
taitube-platform/
├── apps/                        # Deployables. Nothing may depend on these.
│   ├── api/                     # Fastify REST API, SSE streaming, authentication, admin
│   ├── web/                     # React SPA (Create React App 5) — see apps/web/AGENTS.md
│   └── worker/                  # BullMQ distributed queue workers (switchable Node/Bun)
├── packages/                    # Shared libraries. The directory IS the runtime tier.
│   ├── universal/               # Runs in a browser AND on a server
│   │   ├── api-contracts/       # Zod request/response schemas for every HTTP endpoint
│   │   ├── domain/              # Entity types and the status and role vocabularies
│   │   ├── domain-rules/        # Pure rules over input plus an entity, returning Result
│   │   ├── errors/              # ErrorCode vocabulary, Failure types, retry classes
│   │   ├── intl/                # Every user-facing number, date and duration format, on Intl
│   │   ├── messages/            # Typed messages, the en catalogue and the copy for every error code
│   │   ├── pagination/          # Keyset cursor codec and page shapes
│   │   ├── permissions/         # CASL ability rules shared by the API and the frontend
│   │   ├── result/              # Result type, combinators, tryCatch/fromPromise
│   │   ├── tsconfig/            # Shared TypeScript presets, one per tier
│   │   └── validation/          # Pure input-only rules returning Result
│   ├── client/                  # Browser only
│   │   ├── api-client/          # Typed HTTP client whose calls are typed by api-contracts
│   │   └── intl-react/          # IntlProvider, useT, useFormat and <Format> for the web app
│   └── server/                  # Node / Bun only
│       ├── adapters/            # Concrete drivers (postgres, redis, bullmq, s3, auth, in-memory) and registerAdapters
│       ├── compose-autoscaler/  # CLI: scales Compose worker services from the API's queue-depth metrics
│       ├── composition/         # Typed dependency container, tokens, shutdown and signal handling
│       ├── concurrency/         # Singleflight promise coalescing
│       ├── config/              # loadEnv(): reads process.env once and validates it
│       ├── core/                # Abstract class ports and repository interfaces
│       ├── db/                  # Drizzle schema, client, migrations and migrate/seed functions
│       ├── dev-token/           # CLI: mints local EdDSA JWTs and serves a dev JWKS
│       ├── env-schema/          # Zod environment schema, AppConfig and toAppConfig
│       ├── events/              # SSE envelope, pub/sub channels and Redis cache keys
│       ├── ffmpeg/              # FFmpeg/ffprobe runners, ladder selection, master playlist, thumbnails
│       ├── gen-video/           # CLI: generates deterministic test video fixtures
│       ├── job-contracts/       # BullMQ queue names, job payload schemas, retry policies, rendition ladder
│       ├── logger/              # Pino logger with json and pretty formats, log context, serializeError
│       ├── observability/       # OpenTelemetry tracing, Prometheus metrics and the metrics server
│       ├── storage/             # S3 object key layout, MIME map and multipart part math
│       ├── testing/             # Shared test config, fixtures and test helpers
│       └── upload-client/       # CLI: reference resumable multipart upload client
├── infra/
│   ├── compose/                 # Docker Compose manifests (local infra, full stack, observability)
│   ├── k8s/                     # Kubernetes manifests (Kustomize base, local k3d, cloud overlays)
│   ├── observability/           # Grafana dashboards and Prometheus alert rules
│   └── terraform/               # Cloud infrastructure (Cloudflare R2, DNS, Tunnel, Access; Hetzner k3s node)
├── tests/
│   ├── architecture/            # The conformance suite: tier, layer and boundary assertions
│   ├── e2e/                     # Phase 2 acceptance suite (20 concurrent videos + hostile set)
│   ├── in-process/              # In-process specs over a composed app (start order, request correlation)
│   └── load/                    # k6 scenarios
├── tools/                       # Developer assets with no package.json (chaos/, hls-test-page/)
├── docs/                        # PRD, SDD (with the ADRs), standards, runbooks, and tickets
└── scripts/                     # Development, build, boundary, and ticket synchronization scripts
```

---

## Key Capabilities

- **Local-first**: runs offline; local development uses MinIO, Redis and PostgreSQL.
- **Dual runtime**: worker code and packages run under Node.js 24 and Bun 1.4, and the specs pass under both
  `vitest` and `bun test`.
- **Multipart uploads**: parts between `S3_PART_SIZE_MIN_BYTES` and `S3_PART_SIZE_MAX_BYTES` (8 MiB to 64 MiB
  by default), uploaded in parallel, resumable and abortable.
- **HLS ladder**: 1080p, 720p and 480p renditions with the same keyframe cadence, so players can switch cleanly.
- **Progress events**: SSE over Redis Pub/Sub with per-rendition percentage, ETA and state, and a snapshot on
  reconnect.
- **Authorization**: CASL rules over the roles `GUEST`, `USER`, `CREATOR`, `MODERATOR` and `ADMIN` plus
  ownership predicates, enforced in domain services through `AuthorizationPort`; a refusal is an RFC 9457
  Problem Details response.
- **State machine**: PostgreSQL compare-and-set transitions and worker fencing tokens.
- **Public feed**: `GET /v1/feed` sorted by newest, views or trending, filtered by category, with Redis
  caching, Singleflight coalescing and ETag/304 responses.
- **Categories**: `GET /v1/categories` and `POST/PATCH/DELETE /v1/admin/categories`, cached in process (60s
  TTL) and in Redis, invalidated over Redis Pub/Sub, with ETag/304 responses.
- **Reactions**: `PUT /v1/videos/:id/reactions` (LIKE/DISLIKE/NONE) and `GET /v1/videos/:id/reactions/me`,
  with counter columns (`likesCount`, `dislikesCount`) cached by `RedisReactionCacheAdapter` and repaired by
  a scheduled reconciler.
- **Subscriptions**: `POST/DELETE /v1/channels/:id/subscribers`, `GET /v1/channels/:id/subscribers/me` and
  `GET /v1/me/subscriptions`, with self-subscription refused (`CANNOT_SUBSCRIBE_TO_SELF`);
  `GET /v1/feed/subscriptions` is a keyset-paginated feed of `READY` videos from subscribed channels.
- **Comments**: `GET/POST /v1/videos/:id/comments`, `GET /v1/comments/:id/replies`,
  `PATCH/DELETE /v1/comments/:id` and `POST/DELETE /v1/comments/:id/pin`. Threads nest one level, the list
  is keyset-paginated under `sort=top` or `sort=newest` with the pinned comment first, the first top page
  is cached in Redis for 60s, and `videos.comments_count` moves with every write. The author edits, the
  video owner pins and moderates, moderators and admins delete.
- **Playlists**: `POST /v1/playlists`, `GET/PATCH/DELETE /v1/playlists/:id`, `POST /v1/playlists/:id/items`,
  `DELETE /v1/playlists/:id/items/:videoId`, `PUT /v1/playlists/:id/reorder` and
  `GET /v1/me/playlists?videoId=` for the "Save to playlist" dialog. Public, unlisted or private, scoped in
  SQL from the same CASL rules the API checks; every user gets a private Watch Later that cannot be renamed
  or deleted. A drag-and-drop move rewrites the moved item alone.
- **Watch history**: `POST/GET/DELETE /v1/me/history` and `GET/DELETE /v1/me/history/:videoId`. Playback
  heartbeats buffer in Redis for 7 days and reach the `watch_history` row at most once a minute; a pause
  and the end write it straight away, and a video watched past 92 % resumes from the start.
- **Dead letter queue**: permanent failures go to a DLQ that an admin can retry from.
- **Observability**: OpenTelemetry traces for API calls and worker jobs, Prometheus metrics, Grafana
  dashboards and Alertmanager rules; the apps write JSON logs to stdout.

---

## Prerequisites

- **Node.js**: 24.x LTS (`node -v`)
- **pnpm**: >= 10.0.0 (`pnpm -v`)
- **Bun**: >= 1.4.0 (`bun -v`, optional: only `pnpm test:bun` and `make test-bun` need it; every script runs through `tsx`)
- **Docker**: Docker Engine with Docker Compose v2 (`docker compose version`)
- **FFmpeg**: must include the `drawtext` filter (`ffmpeg -filters | grep drawtext`)

`make doctor` checks all of the above except Bun (`make check-bun`) and the `drawtext` filter.

### FFmpeg needs drawtext
`pnpm gen-video` burns a timecode into most fixtures, so an FFmpeg built without
`drawtext` generates 5 of the 13 and fails the rest with `No such filter: 'drawtext'`.
Since FFmpeg 7.1 the filter also needs libharfbuzz, and Homebrew's `ffmpeg` bottle ships
without freetype or harfbuzz. On macOS use the full build:

```bash
brew install ffmpeg-full
brew unlink ffmpeg && brew link --force --overwrite ffmpeg-full
```

Debian and Ubuntu `ffmpeg` packages already include it, which is why CI is unaffected.

### Container runtime
Any runtime providing the `docker` CLI and the Compose v2 plugin works; nothing in the
Makefile depends on Docker Desktop. Colima is a free alternative:

```bash
brew install colima docker docker-compose docker-buildx
colima start --cpu 6 --memory 12 --disk 40 --vm-type vz --mount-type virtiofs
```

Homebrew installs the Compose and buildx plugins outside Docker's search path, so add
`/opt/homebrew/lib/docker/cli-plugins` to `cliPluginsExtraDirs` in `~/.docker/config.json`
or `docker compose` will not be found.

---

## Quick Start with Docker

You can run the full platform using Docker Compose without installing Node, Bun, or FFmpeg locally:

```bash
# 1. Copy local environment variables
cp .env.example .env

# 2. Start all infrastructure, API, and worker services
make up-all

# 3. Run the end-to-end smoke test
make smoke
```

Service endpoints once running:
- **Fastify API**: `http://localhost:3000`
- **MinIO Storage Console**: `http://localhost:9001` (User: `minioadmin`, Password: `minioadmin`)
- **Bull Board Queue UI**: `http://localhost:3000/admin/queues` (Requires admin token)
- **HLS Test Player**: Open `tools/hls-test-page/index.html` in your browser

To stop and remove containers:
```bash
make down
```

---

## Local Development Setup

### 1. Start Infrastructure Services

Start PostgreSQL, Redis, and MinIO storage containers:

```bash
cp .env.example .env
make up
make check-redis
pnpm db:migrate && pnpm db:seed
```

`make up` starts the infrastructure only; `pnpm db:migrate` and `pnpm db:seed` read `.env` and create the
schema and the dev user. `make up-all` runs the whole stack in containers instead, migrations included.

### 2. Install Dependencies and Run Verifications

```bash
# Install workspace dependencies
pnpm install

# Run typechecking across all packages
pnpm typecheck

# Run linter
pnpm lint

# Run unit and integration tests
pnpm test

# Run worker parity tests in Bun
pnpm test:bun
```

### 3. Generate Test Video Fixtures

Create deterministic synthetic video files for testing transcode flows:

```bash
# Generate fast standard fixture set into tests/fixtures/
pnpm gen-video

# Verify generated fixtures against manifest checksums
pnpm gen-video --check
```

### 4. Mint Local Authentication Tokens

Generate signed Ed25519 JWTs for local API authorization:

```bash
# Generate an admin token valid for 8 hours
pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin --ttl 8h

# Start a local standalone JWKS endpoint on port 3001
pnpm dev-token serve --port 3001
```

---

## End-to-End Workflow

### 1. Start API and Workers

Both `dev` scripts run the built `dist/`, so run `pnpm build` first. Then, in separate terminals:

```bash
# Terminal 1: Fastify API
pnpm --filter @vp/api dev

# Terminal 2: Probe Worker
WORKER_STAGE=probe pnpm --filter @vp/worker dev

# Terminal 3: Transcode Workers (one per rendition)
WORKER_STAGE=transcode-1080p pnpm --filter @vp/worker dev
WORKER_STAGE=transcode-720p pnpm --filter @vp/worker dev
WORKER_STAGE=transcode-480p pnpm --filter @vp/worker dev

# Terminal 4: Thumbnail and Package Workers
WORKER_STAGE=thumbnail pnpm --filter @vp/worker dev
WORKER_STAGE=package pnpm --filter @vp/worker dev

# Terminal 5: Notification Worker
WORKER_STAGE=notify pnpm --filter @vp/worker dev

# Terminal 6: Housekeeping Worker
WORKER_STAGE=housekeeping pnpm --filter @vp/worker dev
```

### 2. Upload a Video

Use the reference upload client to ingest a video file:

```bash
pnpm upload-client tests/fixtures/s60.mp4 --title "Demo Video"
```

For large files, the client automatically handles S3 multipart chunking with resume support:

```bash
# Resume an interrupted upload
pnpm upload-client --resume <uploadId> tests/fixtures/s60.mp4

# Abort an upload
pnpm upload-client --abort <uploadId>
```

### 3. Verify Video and Playback

Query the video record via the REST API:

```bash
curl -H "Authorization: Bearer $(pnpm --silent dev-token mint --raw --role admin)" \
  http://localhost:3000/v1/videos/<VIDEO_ID>
```

When processing completes (`status: "READY"`), open the playback URL (`http://localhost:9000/public/videos/<VIDEO_ID>/hls/master.m3u8`) in any HLS player or use the included test harness at `tools/hls-test-page/index.html`.

---

## Observability and Monitoring

A dedicated observability profile provisions Prometheus, Grafana, Tempo, Loki, OpenTelemetry Collector, and Alertmanager:

```bash
# Start observability services
make obs-up

# Verify scraper targets and data sources
make obs-check
```

### Endpoints and Dashboards
- **Grafana**: `http://localhost:3001` (Default credentials: `admin` / `admin`)
  - **Pipeline Overview**: Live video status distribution, throughput, and completion latency.
  - **Queues**: Real-time BullMQ depth by state, backlog vs active workers, and job wait duration.
  - **Workers**: Transcode real-time factor, FFmpeg exit codes, temp disk usage, and DLQ entries.
  - **API Metrics**: RED metrics (Rate, Errors, Duration), active SSE connections, and HTTP request rates.
  - **Storage and Cost**: S3/R2 Class A and Class B operations, output volume, and operation latency.
- **Prometheus**: `http://localhost:9090`
- **Tempo Tracing**: `http://localhost:3200` (OTLP gRPC on `4317`; the OpenTelemetry Collector takes OTLP HTTP on `4318`)
- **Loki Logs**: `http://localhost:3100`
- **Alertmanager**: `http://localhost:9093`

---

## Autoscaling

### Docker Compose Autoscaler

For local development or single-host deployments without Kubernetes, run the built-in queue autoscaler:

```bash
# Run in dry-run mode to inspect scaling calculations
pnpm compose-autoscaler --dry-run

# Run live autoscaling loop against Docker Compose
pnpm compose-autoscaler --interval 10
```

The autoscaler polls the API's `/metrics` endpoint (`bullmq_queue_jobs`, port `9464` by default), computes a target replica count per stage that never drops below the active jobs, and applies it with `docker compose up -d --scale <service>=N --no-recreate`.

### Kubernetes Autoscaling with KEDA

In Kubernetes environments, worker Deployments autoscale from 0 to N replicas using KEDA `ScaledObject` resources triggered by queue depth metrics.

---

## Kubernetes Deployment

Deploy the stack locally using `k3d` or `kind`:

```bash
# 1. Create a local k3d cluster with Helm dependencies
make k3d-up

# 2. Deploy database migrations, Fastify API, and worker deployments
make k3d-deploy

# 3. Execute the smoke test against cluster ingress
make smoke

# 4. Clean up cluster
make k3d-down
```

Manifests are organized with Kustomize under `infra/k8s/base` with overlays for `infra/k8s/overlays/local` and `infra/k8s/overlays/cloud`.

---

## Available Commands

| Command | Description |
|---|---|
| `make doctor` | Run environment pre-flight checks (Node, pnpm, Docker, FFmpeg) |
| `make setup` | Bootstrap: runs `make doctor`, creates `.env`, installs dependencies, runs `make up-all` |
| `make dev` | Alias for `make setup` |
| `make up` | Start local Postgres, Redis, and MinIO containers |
| `make up-all` | Start full stack (infrastructure, migrations, API, and all worker stages) |
| `make down` | Stop the Compose stack and delete its volumes |
| `make prune` | Safe local pruning utility to reclaim Docker disk space |
| `make obs-up` | Start Prometheus, Grafana, Tempo, Loki, and Alertmanager stack |
| `make obs-down` | Stop observability stack |
| `make obs-check` | Verify Prometheus scraping targets and Grafana data sources |
| `make smoke` | Run end-to-end ingestion and playback smoke tests |
| `make smoke-fast` | Fast-path local smoke test against existing running containers |
| `make smoke-offline` | Run the stack with the offline Compose overlay, assert zero internet egress, then run the smoke test |
| `make e2e` | Run the Phase 2 acceptance suite (`E2E_REDUCED=true` for the smaller CI set) |
| `make k3d-up` | Create local k3d Kubernetes cluster with in-cluster dependencies |
| `make k3d-deploy` | Deploy API and worker stages to Kubernetes via Kustomize |
| `make k3d-down` | Tear down local k3d Kubernetes cluster |
| `make nuke` | Destroy all containers, networks, and persistent data volumes |
| `make help` | List every Makefile target (load, chaos, psql, logs and more) |
| `pnpm dev` | Run monorepo development services via Turborepo |
| `pnpm build` | Run `pnpm boundaries`, then build all workspace packages and applications |
| `pnpm typecheck` | Run TypeScript compiler checks across all workspaces |
| `pnpm lint` | Run Biome linter across the repository |
| `pnpm boundaries` | Check package tiers, dependency layers, and `CLAUDE.md` symlinks (runs first inside `build` and `typecheck`) |
| `pnpm sync:claude` | Create the `CLAUDE.md` symlink beside every `AGENTS.md` |
| `pnpm format` | Format repository code using Biome |
| `pnpm test` | Run every Vitest project, the architecture suite included |
| `pnpm test:unit` | Run the Vitest projects without the architecture suite |
| `pnpm test:architecture` | Run the architecture invariant suite in `tests/architecture/` |
| `pnpm test:bun` | Run the worker and package suites under `bun test` |
| `pnpm knip` | Report unused files, exports and dependencies |
| `pnpm db:migrate` | Apply database migrations (`apps/api/src/migrate.ts`) |
| `pnpm db:seed` | Seed the local database (`apps/api/src/seed.ts`; refuses under `production`) |
| `pnpm gen-video` | Generate deterministic video test fixtures |
| `pnpm dev-token` | Mint, verify and serve local EdDSA dev JWTs and their JWKS |
| `pnpm upload-client` | Run the reference resumable upload CLI |
| `pnpm compose-autoscaler` | Run the Docker Compose queue-depth autoscaler |
| `pnpm sync:tickets` | Synchronize local markdown tickets with GitHub Issues |

---

## Engineering Standards

1. **Local-First Guarantees**: All core services function without internet access or third-party cloud accounts.
2. **Dependency Inversion (Hexagonal Architecture)**: Domain business logic in `packages/server/core` depends only on abstract port interfaces. Concrete adapters (`postgres`, `redis`, `s3`, `bullmq`) are isolated in `packages/server/adapters` and wired at composition roots (`apps/api`, `apps/worker`).
3. **Modular Repository Discipline**: Every repository implementation resides in its own dedicated file under `packages/server/adapters/{postgres,in-memory}/repositories/` with strict modularity (<= 250 lines target).
4. **Single-Source Contracts**: Job payloads are defined in `@vp/job-contracts`, storage paths in `@vp/storage`, error codes in `@vp/errors`, and the environment schema in `@vp/env-schema` (read once by `loadEnv()` in `@vp/config`).
5. **State Durability**: All entity mutations execute through compare-and-set transactions that record audit events in `video_events` with fencing tokens.
6. **Dual-Runtime Compatibility**: All worker logic and shared libraries run cleanly under both Node.js and Bun without runtime-specific proprietary APIs.
7. **Package Runtime Tiers**: A package's directory under `packages/{universal,server,client}` declares where its code may run, and `vp.layer` declares which way its dependencies may point. `pnpm boundaries` fails the build on a violation. See [packages/AGENTS.md](packages/AGENTS.md).
8. **Optimal Execution & Zero-Waste Efficiency**: All developer setups, Docker builds, CI workflows, test suites, and scripts are strictly optimized for speed and caching (Buildx GHA layer caching, sub-second Biome linting, incremental TypeScript builds, fast-polling health checks, and ultra-short test fixtures). Sluggish developer feedback loops, un-cached container rebuilds, and slow test runs are treated as defects.

---

## Documentation Index

- [Hexagonal Architecture (Ports & Adapters)](ARCHITECTURE.md): Architectural boundaries, ports, repositories, and dependency inversion rules.
- [Agent Guidelines](AGENTS.md): Core rules, workspace directory index, and definition of done.
- [Testing Standards & Strategy](docs/standards/testing.md): Layered test pyramid, in-memory port doubles, durability tests, and dual-runtime parity.
- [Git Workflow & Pull Requests](docs/standards/git-workflow.md): Branch protection, squash-and-merge policy, and reviewer loops.
- [File Discipline & Sizing](docs/standards/file-discipline.md): Modularity, <= 250 lines target, and repository file organization.
- [Declarative Authorization](docs/standards/authorization.md): CASL ability engine, role hierarchy, and route protection.
- [Error Handling](docs/standards/error-handling.md): `Result` at the domain seam - rules return, services compose, the edge decides (SDD ADR-24).
- [Domain Glossary & Model](CONTEXT.md): Ubiquitous domain language, entities, and seam discipline.
- [Package Tiers & Dependency Layers](packages/AGENTS.md): Where each package may run, which way dependencies point, and how both are enforced.
- [System Design Document (SDD)](docs/SDD.md): Deep dives, database schemas, and §4, the Architecture Decision Records (every ADR lives there).
- [Product Requirements Document (PRD)](docs/PRD.md): Product goals, functional requirements, and service-level objectives.
- [Local-First Architecture Guide](docs/LOCAL_FIRST.md): Guide for running and verifying offline operations.
- [Backlog & Work Breakdown](docs/tickets/README.md): Roadmap of vertical tracer-bullet work items and dependency graphs.

