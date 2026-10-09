---
name: vp-run-all
description: Start, verify, and operate the complete video-pipeline local stack — infrastructure (Postgres, Redis, MinIO), application (Fastify API, every BullMQ worker stage and the web app), and optionally the observability profile (Prometheus, Grafana, Tempo, Loki, OTel Collector, Alertmanager). Covers Windows PowerShell and Unix/bash variants, health checks, log monitoring, smoke testing, and safe teardown. Use whenever asked to "run everything", "start the full stack", "bring up all services", "launch the app", or any variant of starting the full local environment.
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

# 2. Build the images and start everything: infra, migrate, API, every worker stage and the web app
make up all

# 3. Verify everything is healthy
make smoke
```

`make up` (`pnpm stack`, `packages/server/stack`) starts a tier at a time, gates each tier on its health
checks, and ends on a table of every service and its URL; on a failure it names the service and prints its
last log lines. `make status` prints the same table later.

---

## 2. Service Inventory

Containers have no fixed names: compose derives them from the project (`video-pipeline-api-1`). Address a
service by its compose service name, and a container by its labels
(`docker ps -q --filter label=com.docker.compose.project=video-pipeline --filter label=com.docker.compose.service=api`).

| Service | Profile | Port(s) | Role |
|---|---|---|---|
| postgres (18) | — | `5432` | Primary datastore (videos, events, steps, renditions) |
| redis (8) | — | `6379` | BullMQ job queues (db 0) + Pub/Sub SSE (db 1) |
| minio | — | `9000` (API), `9001` (console) | S3-compatible raw + public object storage |
| minio-init | — | — | One-shot: creates buckets, sets anonymous policy, adds 7-day ILM |
| migrate | `migrate` | — | One-shot: runs Drizzle schema migrations |
| api | `api` | `3000` (HTTP), `9464` (Prometheus) | Upload API, SSE, admin dashboard |
| web | `web` | `5173` | TanStack Start SSR server and client assets |
| worker-probe | `worker` | — | Validates video with ffprobe, queues transcode fan-out |
| worker-transcode-1080p | `worker` | — | Transcodes 1080p H.264/AAC -> HLS segments |
| worker-transcode-720p | `worker` | — | Transcodes 720p rendition |
| worker-transcode-480p | `worker` | — | Transcodes 480p rendition |
| worker-thumbnail | `worker` | — | Extracts sprite sheet thumbnail |
| worker-package | `worker` | — | Assembles HLS master playlist, updates video to READY |
| worker-notify | `worker` | — | Fires outbound webhooks on READY/FAILED |
| worker-housekeeping | `worker` | — | Reconciler: retries stuck jobs, purges expired raw objects |

A raw `docker compose` command that spans the project (`logs`, `ps`, `down`) or acts on an app service
takes `--profile '*'`, or it does not see the apps.

---

## 3. Step-by-Step Startup

### 3a. Infrastructure only (fastest iteration)

```bash
make up          # Postgres + Redis + MinIO + minio-init
make check-redis # Assert noeviction + appendonly
make smoke-infra # Full infrastructure health checks
```

### 3b. One app, or the full stack

```bash
make up api                 # infrastructure, migrate and the API
make up web                 # the same plus the web app
make up worker              # infrastructure, migrate and every worker stage
make up worker:thumbnail    # one stage; worker:transcode is the three renditions
make up all                 # everything above
```

### 3c. Full stack + Observability (Prometheus, Grafana, Tempo, Loki, OTel, Alertmanager)

```bash
make up all observability   # or `make up observability` on top of a running stack
make obs-check              # Verifies all Prometheus targets are UP
```

### 3d. Full stack + HLS test page (browser player)

```bash
make up tools
# Open http://localhost:8080
```

---

## 4. Service Endpoints (All Local)

| URL | Service | Notes |
|---|---|---|
| `http://localhost:5173` | Web app | (web profile) |
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
# Follow the logs of every service
make logs

# Follow only a specific service
docker compose -f infra/compose/docker-compose.yml --profile '*' logs -f api
docker compose -f infra/compose/docker-compose.yml --profile '*' logs -f worker-probe

# Every service, its state and its URL
make status

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
# Stop every service, every profile included, and delete the volumes (local data is disposable)
make down
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
| `make up all` fails on `migrate` | It names the service and prints its log | Fix the migration; `make down && make up all` |
| API returns 503 on `/healthz` | Postgres/Redis/MinIO not ready | `make check-redis && make smoke-infra` |
| Videos stuck in `PROCESSING` | Worker crashed | `make status`, then `docker compose -f infra/compose/docker-compose.yml --profile '*' logs worker-probe`; check tmpfs size |
| HLS playlist returns 403 | MinIO anonymous policy missing | `make down && make up all` (re-runs minio-init) |
| Observability targets DOWN | Services not exposing metrics | Ensure `METRICS_PORT=9464` in `.env`; check `make obs-check` |
| OOM on transcode workers | tmpfs too small | Increase `tmpfs` size in `docker-compose.yml`; reduce `FFMPEG_THREADS` |
| Port conflict on 3000/9000 | Another app using ports | PowerShell: `netstat -ano | findstr :3000`; Unix: `lsof -i :3000` |

---

## 14. Windows PowerShell Equivalents

The `Makefile` targets use bash. On Windows, `make up`, `make down` and `make status` are `pnpm stack`, which
runs anywhere Node does:

```powershell
# Start full stack (infra + apps); `pnpm stack --help` lists the targets
pnpm stack up all

# Start infra only
pnpm stack up

# Status, and stop everything (deletes the volumes)
pnpm stack status
pnpm stack down

# Follow logs
docker compose -f infra/compose/docker-compose.yml --profile '*' logs -f

# Follow single service
docker compose -f infra/compose/docker-compose.yml --profile '*' logs -f api

# Open psql
docker compose -f infra/compose/docker-compose.yml exec postgres psql -U vp -d vp

# Open Redis CLI
docker compose -f infra/compose/docker-compose.yml exec redis redis-cli -a vp

# With observability
pnpm stack up all observability

# With HLS test page
pnpm stack up tools
```

> **Tip**: Install [Git for Windows](https://git-scm.com/download/win) to get bash and use `make` directly via the Git Bash terminal or WSL2.

---

## 15. Service Startup Order (dependency graph)

`depends_on` in `infra/compose/docker-compose.yml` is the only dependency map; `pnpm stack` reads it from
`docker compose config` and starts it as tiers:

```
postgres, redis, minio  ->  minio-init, migrate  ->  api, workers (all stages)  ->  web
```

A tier is done when every health check passes and every one-shot (`minio-init`, `migrate`) has exited 0.
