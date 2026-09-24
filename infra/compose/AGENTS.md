# AGENTS.md — infra/compose (Docker Compose Topologies)

Instructions for any coding agent working on Docker Compose manifests (`infra/compose`).

---

## 1. Scope & Manifests

`infra/compose` defines the containerized environments for local development, CI testing, and observability:
- `docker-compose.yml`: one file, with profiles for the extras.
  - Default (no profile): PostgreSQL 16, Redis 7, MinIO, `minio-init` (runs `minio-init.sh`), `migrate` (migrations, then seed), `api`, and one service per worker stage (`worker-probe`, `worker-transcode-1080p`, `worker-transcode-720p`, `worker-transcode-480p`, `worker-thumbnail`, `worker-package`, `worker-notify`, `worker-housekeeping`). Workers build with `WORKER_RUNTIME` (default `bun`).
  - `observability`: Prometheus, Alertmanager, Grafana, Tempo, Loki and the OTel collector, configured from the folders beside the file and from `infra/observability/`.
  - `chaos`: Toxiproxy, proxying MinIO (`:9002`) and Redis (`:6380`) as `toxiproxy/toxiproxy.json` declares.
  - `tools`: `hls-test-page`, nginx serving `tools/hls-test-page` on `:8080`.
- `docker-compose.offline.yml`: overrides the default network with `internal: true`; `make smoke-offline` layers it on and asserts the API container cannot reach the internet.
- `docker-compose.chaos.yml`: points `worker-notify` at Redis through Toxiproxy, for `make chaos-readiness` (`scripts/chaos-readiness.sh`).
- `test.sh`: the infrastructure smoke run behind `make smoke-infra`.

---

## 2. Invariants & Rules

1. **Fast Healthchecks:** Healthchecks poll fast so `up --wait` returns in seconds: `interval: 1s`, `timeout: 2s`, `retries: 30` for Postgres, Redis and the API (`/readyz`); workers use `interval: 5s`, `retries: 6` against `/readyz` on their metrics port.
2. **Redis Durability:** The Redis command MUST keep `--appendonly yes --maxmemory-policy noeviction` (`make check-redis` asserts both).
3. **Build Caching:** `apps/api/Dockerfile` and `apps/worker/Dockerfile` run `turbo prune --docker`, install from the pruned manifests before copying the source, and mount the shared `pnpm-store` BuildKit cache for `pnpm install` and the turbo build. Keep that order.
4. **Clean Volume Mounts:** Named volumes (`pgdata`, `redisdata`, `miniodata`) hold local state outside the checkout; workers get a `/tmp/vp` tmpfs. `make down` and `make nuke` both remove the volumes.

---

## 3. Dedicated Skills

- **`docker`**: Dockerfile optimization and compose management.
- **`vp-chaos-toxiproxy`**: Operating Toxiproxy chaos toxics.
- **`vp-local-first-check`**: Verifying offline isolation with `docker-compose.offline.yml`.

---

## 4. Local Commands

```bash
# Start every default-profile service (infra, migrate, API, workers), building images only if missing
make up

# The same, rebuilding the API and worker images first
make up-all

# Stop containers and remove volumes
make down

# Run offline smoke test
make smoke-offline

# Start the observability profile
make obs-up

# Start Toxiproxy (chaos profile)
make toxiproxy-up
```
