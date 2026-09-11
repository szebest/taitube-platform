---
name: vp-run-all
description: Start, verify, and operate the complete video-pipeline local stack — infrastructure (Postgres, Redis, MinIO), application (Fastify API + all 7 BullMQ worker stages), and optionally the observability profile (Prometheus, Grafana, Tempo, Loki, OTel Collector, Alertmanager). Covers Windows PowerShell and Unix/bash variants, health checks, log monitoring, smoke testing, and safe teardown. Use whenever asked to "run everything", "start the full stack", "bring up all services", "launch the app", or any variant of starting the full local environment.
license: MIT
metadata:
  project: video-pipeline
  pairs-with: vp-local-first-check, vp-work-ticket, vp-chaos-toxiproxy
---

# vp-run-all — Start & Operate the Full video-pipeline Stack

> **Prerequisite**: Docker Desktop must be running. All commands are from the repo root.

---

## 1. Quick Start (3 commands)

```bash
# 1. Set up environment (first time only)
cp .env.example .env

# 2. Start the full stack (infra + migrations + API + all workers)
make up-all

# 3. Verify everything is healthy
make smoke
```

That's it. The `make up-all` command builds images and waits for all services to pass their health checks before returning.

---

## 2. Service Inventory

| Service | Container | Port(s) | Role |
|---|---|---|---|
| PostgreSQL 16 | `vp-postgres` | `5432` | Primary datastore (videos, events, steps, renditions) |
| Redis 7 | `vp-redis` | `6379` | BullMQ job queues (db 0) + Pub/Sub SSE (db 1) |
| MinIO | `vp-minio` | `9000` (API), `9001` (console) | S3-compatible raw + public object storage |
| minio-init | `vp-minio-init` | — | One-shot: creates buckets, sets anonymous policy, adds 7-day ILM |
| migrate | `vp-migrate` | — | One-shot: runs Drizzle schema migrations |
| Fastify API | `vp-api` | `3000` (HTTP), `9464` (Prometheus) | Upload API, SSE, admin dashboard |
| worker-probe | — | — | Validates video with ffprobe, queues transcode fan-out |
| worker-transcode-1080p | — | — | Transcodes 1080p H.264/AAC → HLS segments |
| worker-transcode-720p | — | — | Transcodes 720p rendition |
| worker-transcode-480p | — | — | Transcodes 480p rendition |
| worker-thumbnail | — | — | Extracts sprite sheet thumbnail |
| worker-package | — | — | Assembles HLS master playlist, updates video to READY |
| worker-notify | — | — | Fires outbound webhooks on READY/FAILED |
| worker-housekeeping | — | — | Reconciler: retries stuck jobs, purges expired raw objects |

---

## 3. Step-by-Step Startup

### 3a. Infrastructure only (fastest iteration)

```bash
make up          # Postgres + Redis + MinIO + minio-init (no build)
make check-redis # Assert noeviction + appendonly
make smoke-infra # Full infrastructure health checks
```

### 3b. Full stack with all applications

```bash
make up-all      # Builds images + starts everything, --wait blocks until all healthy
```

### 3c. Full stack + Observability (Prometheus, Grafana, Tempo, Loki, OTel, Alertmanager)

```bash
# Option A: Start observability alongside the full stack
docker compose -f infra/compose/docker-compose.yml --profile observability up -d --build --wait

# Option B: Start observability on top of an already-running stack
make obs-up
make obs-check   # Verifies all Prometheus targets are UP
```

### 3d. Full stack + HLS test page (browser player)

```bash
docker compose -f infra/compose/docker-compose.yml --profile tools up -d
# Open http://localhost:8080
```

---

## 4. Service Endpoints (All Local)

| URL | Service | Notes |
|---|---|---|
| `http://localhost:3000` | Fastify API | Main HTTP API |
| `http://localhost:3000/healthz` | API liveness | Returns 200 when ready |
| `http://localhost:3000/readyz` | API readiness | Checks DB + Redis + S3 |
| `http://localhost:3000/metrics` | Prometheus metrics | Scraped by Prometheus |
| `http://localhost:3000/admin/queues` | Bull Board | Queue dashboard (admin token required) |
| `http://localhost:9000` | MinIO S3 API | S3-compatible object storage |
| `http://localhost:9001` | MinIO Console | Web UI (minioadmin / minioadmin) |
| `http://localhost:5432` | PostgreSQL | Direct DB connection |
| `http://localhost:6379` | Redis | BullMQ + Pub/Sub |
| `http://localhost:9090` | Prometheus | (observability profile only) |
| `http://localhost:3001` | Grafana | (observability profile only) admin/admin |
| `http://localhost:3200` | Tempo | (observability profile only) |
| `http://localhost:3100` | Loki | (observability profile only) |
| `http://localhost:4318` | OTel Collector | (observability profile only) |
| `http://localhost:9093` | Alertmanager | (observability profile only) |
| `http://localhost:8080` | HLS test page | (tools profile only) |

---

## 5. Authentication for API Calls

The API uses EdDSA (Ed25519) JWTs in dev mode. Mint tokens locally — no internet required:

```bash
# Mint an admin token (8h TTL)
pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin --ttl 8h

# Use in curl
TOKEN=$(pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/videos
```

Admin token alternative (no JWT): set `x-admin-token: <ADMIN_TOKEN>` header using the value from `.env`.

---

## 6. Upload Your First Video

```bash
# Quick upload using the upload script
bash scripts/upload.sh tests/fixtures/s15.mp4 "My Test Video"

# Or step-by-step curl:
TOKEN=$(pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin)

# 1. Initiate upload
RESP=$(curl -sf -X POST http://localhost:3000/v1/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.mp4","contentType":"video/mp4","fileSize":1000000}')

# 2. PUT file to the presigned URL (uploadUrl field in response)
# 3. Complete the upload (completionUrl field in response)
```

---

## 7. Monitor & Debug

```bash
# Follow all compose logs
make logs

# Follow only a specific service
docker compose -f infra/compose/docker-compose.yml logs -f api
docker compose -f infra/compose/docker-compose.yml logs -f worker-probe

# Open psql shell
make psql

# Open Redis CLI
make redis-cli

# Check a specific video's status
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/videos/<VIDEO_ID>

# Watch SSE events for a video in real-time
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/v1/videos/<VIDEO_ID>/events
```

---

## 8. Run Smoke & E2E Tests

```bash
# Infrastructure health
make smoke-infra

# Full E2E smoke: uploads s15.mp4, waits for READY, verifies HLS playlist + segments
make smoke

# Full offline smoke (zero network egress, uses internal Docker network only)
make smoke-offline

# Phase 2 E2E suite (20 concurrent videos + hostile input set)
make e2e
```

---

## 9. Load Tests (k6)

```bash
# Upload storm: 200 VUs uploading in parallel
make load-s1

# Large file: single 1 GB file upload
make load-s2

# Backlog burst: 500 jobs queued simultaneously
make load-s3

# Quick reduced smoke variant
make load-smoke
```

---

## 10. Compose Autoscaler (no Kubernetes needed)

The autoscaler watches BullMQ queue depths and scales worker containers dynamically:

```bash
# Dry run — prints what it would do
pnpm compose-autoscaler --dry-run

# Live autoscaling (polls every 10 seconds)
pnpm compose-autoscaler --interval 10
```

---

## 11. Stop & Teardown

```bash
# Stop all containers (preserves volumes)
make down

# Stop observability stack only
make obs-down

# Nuclear option: destroy containers + volumes (data loss!)
make nuke
```

---

## 12. Kubernetes (k3d / kind) — Optional

```bash
# Create local k3d cluster + install Helm charts (KEDA, Prometheus, Redis, MinIO, Postgres)
make k3d-up

# Build, import images, apply Kustomize, wait for migrations + deployments
make k3d-deploy

# Run smoke against k3d ingress
make smoke

# Tear down cluster
make k3d-down
```

---

## 13. Troubleshooting

| Symptom | Diagnosis | Fix |
|---|---|---|
| `docker daemon not running` | Docker Desktop not started | Start Docker Desktop and wait ~30s |
| `make up-all` hangs on `migrate` | DB not ready | `make logs` → check postgres; try `make nuke && make up-all` |
| API returns 503 on `/healthz` | Postgres/Redis/MinIO not ready | `make check-redis && make smoke-infra` |
| Videos stuck in `PROCESSING` | Worker crashed | `docker compose logs worker-probe`; check tmpfs size |
| HLS playlist returns 403 | MinIO anonymous policy missing | `make nuke && make up-all` (re-runs minio-init) |
| Observability targets DOWN | Services not exposing metrics | Ensure `METRICS_PORT=9464` in `.env`; check `make obs-check` |
| OOM on transcode workers | tmpfs too small | Increase `tmpfs` size in `docker-compose.yml`; reduce `FFMPEG_THREADS` |
| Port conflict on 3000/9000 | Another app using ports | PowerShell: `netstat -ano | findstr :3000`; Unix: `lsof -i :3000` |

---

## 14. Windows PowerShell Equivalents

The `Makefile` targets use bash. On Windows, call `docker compose` and `pnpm` directly:

```powershell
# Start full stack (infra + apps)
docker compose -f infra/compose/docker-compose.yml up -d --build --wait

# Start infra only
docker compose -f infra/compose/docker-compose.yml up -d --wait postgres redis minio minio-init

# Stop
docker compose -f infra/compose/docker-compose.yml down

# Nuclear teardown (destroys volumes)
docker compose -f infra/compose/docker-compose.yml down -v --remove-orphans

# Follow logs
docker compose -f infra/compose/docker-compose.yml logs -f

# Follow single service
docker compose -f infra/compose/docker-compose.yml logs -f api

# Open psql
docker compose -f infra/compose/docker-compose.yml exec postgres psql -U vp -d vp

# Open Redis CLI
docker compose -f infra/compose/docker-compose.yml exec redis redis-cli -a vp

# With observability
docker compose -f infra/compose/docker-compose.yml --profile observability up -d --build --wait

# With HLS test page
docker compose -f infra/compose/docker-compose.yml --profile tools up -d
```

> **Tip**: Install [Git for Windows](https://git-scm.com/download/win) to get bash and use `make` directly via the Git Bash terminal or WSL2.

---

## 15. Service Startup Order (dependency graph)

```
postgres ──┐
           ├──► migrate ──────────────────────────────────────────► api
redis ─────┤                                                         │
minio ─────┼──► minio-init ─────────────────────────────────────────┤
           │                                                         │
           └─────────────────────────────────────────────────────► workers (all stages)
```

The `--wait` flag on `docker compose up` blocks until every service's healthcheck passes. Services with `restart: on-failure` automatically retry if they crash during startup.
