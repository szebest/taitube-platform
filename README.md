# TaiTube Platform

[![CI](https://github.com/szebest/taitube-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/szebest/taitube-platform/actions/workflows/ci.yml)

TaiTube is an asynchronous video ingestion, processing, and streaming platform. It provides direct-to-storage multipart uploads, keyframe-aligned multi-rendition HLS transcoding via FFmpeg, distributed job coordination with BullMQ, real-time Server-Sent Events (SSE) progress tracking, and full observability out of the box.

The repository is structured as a modular TypeScript monorepo designed around hexagonal architecture (ports and adapters), dual-runtime execution (Node.js 24 and Bun 1.4), and a strict local-first approach that runs completely offline with zero external cloud dependencies.

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
├── apps/
│   ├── api/                 # Fastify REST API, SSE streaming, authentication, admin
│   ├── web/                 # React frontend application
│   └── worker/              # BullMQ distributed queue workers (switchable Node/Bun)
├── core/                    # Pure domain models, entities, and port interfaces
├── adapters/                # Concrete drivers for external systems
│   ├── postgres/            # PostgreSQL repository implementations via Drizzle ORM
│   ├── redis/               # Redis connection pools and pub/sub client
│   ├── bullmq/              # BullMQ queue and worker adapter implementations
│   ├── s3/                  # S3 and MinIO storage client adapter
│   └── in-memory/           # High-speed in-memory test doubles for unit and integration suites
├── packages/                # Shared internal libraries
│   ├── config/              # Centralized environment variable validation (Zod)
│   ├── db/                  # PostgreSQL schema definitions, migrations, and seeds
│   ├── errors/              # Domain and HTTP error classifications (RFC 9457)
│   ├── events/              # Event definitions and Redis pub/sub dispatcher
│   ├── ffmpeg/              # FFmpeg argument builders, progress parsers, probe helpers
│   ├── job-contracts/       # BullMQ job payload schemas and queue naming contracts
│   ├── observability/       # OpenTelemetry, Prometheus metrics, and Pino logging
│   ├── storage/             # S3 object key layout and presigned URL helpers
│   └── testing/             # Shared test utilities, fixtures, and assertion helpers
├── infra/
│   ├── compose/             # Docker Compose manifests (local infra, full stack, observability)
│   ├── k8s/                 # Kubernetes manifests (Kustomize base, local k3d, and cloud overlays)
│   └── terraform/           # Cloud infrastructure definitions (Cloudflare R2, DNS, compute)
├── tools/
│   ├── compose-autoscaler/  # Queue-depth based autoscaler for Docker Compose
│   ├── dev-token/           # Ed25519 JWT generator and local JWKS mock server
│   ├── gen-video/           # Deterministic synthetic video fixture generator
│   └── upload-client/       # Reference CLI for resumable multipart uploads
├── docs/                    # Architecture documentation, PRD, SDD, ADRs, runbooks, and tickets
└── scripts/                 # Development, build, and ticket synchronization scripts
```

---

## Key Capabilities

- **Local-First Architecture**: Runs fully offline with zero external network access. Local development uses MinIO, Redis, and PostgreSQL with default credentials.
- **Dual-Runtime Worker Parity**: Worker services and packages execute interchangeably under Node.js 24 and Bun 1.4. All test suites pass under both `vitest` and `bun test`.
- **Direct Multipart Storage Uploads**: S3-compatible chunked uploads with automatic part sizing (8 MiB to 64 MiB), concurrency control, checksum verification, resume from stored parts, and abort cleanup.
- **Keyframe-Aligned HLS Ladder**: Transcodes multi-bitrate video streams (1080p, 720p, 480p) with identical keyframe cadence across renditions for clean adaptive bitrate switching in video players.
- **Real-Time Progress Tracking**: Server-Sent Events (SSE) backed by Redis Pub/Sub broadcast per-rendition percentage, ETA, and state changes with snapshot replay on reconnect.
- **Resilient State Machine**: Optimistic concurrency control via PostgreSQL CAS transactions and worker fencing tokens to guarantee exactly-once processing outcomes.
- **Dead Letter Queue and Reprocessing**: Permanent failures route to a dedicated DLQ queue with complete error classification and administrative retry capabilities.
- **Comprehensive Observability**: Pre-configured OpenTelemetry tracing across all API calls and worker jobs, Prometheus RED metrics, Grafana dashboards, Loki log aggregation, and Alertmanager rules.

---

## Prerequisites

- **Node.js**: 24.x LTS (`node -v`)
- **pnpm**: >= 10.0.0 (`pnpm -v`)
- **Bun**: >= 1.4.0 (`bun -v`, optional for Bun worker runtime)
- **Docker**: Docker Engine with Docker Compose v2 (`docker compose version`)

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
make up
make check-redis
```

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

In separate terminals:

```bash
# Terminal 1: Fastify API
pnpm --filter @vp/api dev

# Terminal 2: Probe Worker
WORKER_STAGE=probe pnpm --filter @vp/worker dev

# Terminal 3: Transcode Workers (run one or more renditions)
WORKER_STAGE=transcode-720p pnpm --filter @vp/worker dev
WORKER_STAGE=transcode-1080p pnpm --filter @vp/worker dev

# Terminal 4: Thumbnail and Package Workers
WORKER_STAGE=thumbnail pnpm --filter @vp/worker dev
WORKER_STAGE=package pnpm --filter @vp/worker dev

# Terminal 5: Notification Worker
WORKER_STAGE=notify pnpm --filter @vp/worker dev
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
curl -H "Authorization: Bearer $(pnpm dev-token mint --role admin)" \
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
- **Tempo Tracing**: `http://localhost:3200` (OTLP receiver on ports `4317` and `4318`)
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

The autoscaler monitors BullMQ backlog metrics from Prometheus, computes target worker replica counts with active-job protection, and dynamically adjusts container instances using `docker compose scale`.

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
| `make doctor` | Run environment pre-flight checks (Node, Bun, Docker, FFmpeg) |
| `make setup` | One-command fast bootstrap: creates .env, starts services, runs migrations |
| `make dev` | Start infrastructure and run API/workers in dev mode |
| `make up` | Start local Postgres, Redis, and MinIO containers |
| `make up-all` | Start full stack (infrastructure, migrations, API, and all worker stages) |
| `make down` | Stop running containers instantly |
| `make prune` | Safe local pruning utility to reclaim Docker disk space |
| `make obs-up` | Start Prometheus, Grafana, Tempo, Loki, and Alertmanager stack |
| `make obs-down` | Stop observability stack |
| `make obs-check` | Verify Prometheus scraping targets and Grafana data sources |
| `make smoke` | Run end-to-end ingestion and playback smoke tests |
| `make smoke-fast` | Fast-path local smoke test against existing running containers |
| `make smoke-offline` | Run smoke tests with simulated network isolation |
| `make e2e` | Run full end-to-end integration test suite |
| `make k3d-up` | Create local k3d Kubernetes cluster with in-cluster dependencies |
| `make k3d-deploy` | Deploy API and worker stages to Kubernetes via Kustomize |
| `make k3d-down` | Tear down local k3d Kubernetes cluster |
| `make nuke` | Destroy all containers, networks, and persistent data volumes |
| `pnpm dev` | Run monorepo development services via Turborepo |
| `pnpm build` | Build all workspace packages and applications |
| `pnpm typecheck` | Run TypeScript compiler checks across all workspaces |
| `pnpm lint` | Run Biome linter across the repository |
| `pnpm format` | Format repository code using Biome |
| `pnpm test` | Run Vitest test suites across all packages |
| `pnpm test:bun` | Run worker and shared package test suites using Bun test runner |
| `pnpm gen-video` | Generate deterministic video test fixtures |
| `pnpm dev-token` | Mint local Ed25519 JWTs and run mock JWKS server |
| `pnpm upload-client` | Run reference multipart upload CLI |
| `pnpm compose-autoscaler` | Run Docker Compose queue autoscaler daemon |
| `pnpm sync:tickets` | Synchronize local markdown tickets with GitHub Issues |

---

## Engineering Standards

1. **Local-First Guarantees**: All core services function without internet access or third-party cloud accounts.
2. **Dependency Inversion (Hexagonal Architecture)**: Domain business logic in `core/` depends only on abstract port interfaces. Concrete adapters (`postgres`, `redis`, `s3`, `bullmq`) are isolated in `adapters/` and wired at composition roots (`apps/api`, `apps/worker`).
3. **Modular Repository Discipline**: Every repository implementation resides in its own dedicated file under `adapters/*/repositories/` with strict modularity (<= 250 lines target).
4. **Single-Source Contracts**: Job payloads are defined in `@vp/job-contracts`, storage paths in `@vp/storage`, error codes in `@vp/errors`, and environment configuration in `@vp/config`.
5. **State Durability**: All entity mutations execute through compare-and-set transactions that record audit events in `video_events` with fencing tokens.
6. **Dual-Runtime Compatibility**: All worker logic and shared libraries run cleanly under both Node.js and Bun without runtime-specific proprietary APIs.
7. **Optimal Execution & Zero-Waste Efficiency**: All developer setups, Docker builds, CI workflows, test suites, and scripts are strictly optimized for speed and caching (Buildx GHA layer caching, sub-second Biome linting, incremental TypeScript builds, fast-polling health checks, and ultra-short test fixtures). Sluggish developer feedback loops, un-cached container rebuilds, and slow test runs are treated as defects.

---

## Documentation Index

- [System Design Document (SDD)](docs/SDD.md): System architecture, database schemas, and 18 Architecture Decision Records (ADRs).
- [Product Requirements Document (PRD)](docs/PRD.md): Product goals, functional requirements, and service-level objectives.
- [Local-First Guide](docs/LOCAL_FIRST.md): Guide for running and verifying offline operations.
- [Backlog and Work Breakdown](docs/tickets/README.md): Roadmap of 80 vertical tracer-bullet work items and dependency graphs.
- [Agent and Contributor Guidelines](AGENTS.md): Coding conventions, Definition of Done, and architectural constraints.
