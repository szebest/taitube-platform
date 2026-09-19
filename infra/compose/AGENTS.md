# AGENTS.md — infra/compose (Docker Compose Topologies)

Instructions for any coding agent working on Docker Compose manifests (`infra/compose`).

---

## 1. Scope & Manifests

`infra/compose` defines the containerized environments for local development, CI testing, and observability:
- `docker-compose.yml`: Core local infrastructure (PostgreSQL 16, Redis 7, MinIO storage, minio bucket initializer), API service, and worker stages (`probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`).
- `docker-compose.offline.yml`: Network-isolated container bridge with `internal: true` used by `make smoke-offline` to mechanically verify zero-network egress.
- `docker-compose.toxiproxy.yml`: Toxiproxy proxy containers for chaos resilience testing (injecting latency, 503 errors, and TCP stream cuts to MinIO and Redis).

---

## 2. Invariants & Rules

1. **Fast Healthchecks:** Container healthchecks must use fast intervals (e.g. `interval: 2s`, `timeout: 1s`, `retries: 10`) so services become healthy in seconds.
2. **Redis Durability:** Redis container command MUST enforce `--appendonly yes --maxmemory-policy noeviction`.
3. **Build Caching:** Docker builds must leverage Buildx layer caching. Do not invalidate layers unnecessarily.
4. **Clean Volume Mounts:** Named persistent volumes (`postgres-data`, `redis-data`, `minio-data`) must isolate local state without polluting the git working tree.

---

## 3. Dedicated Skills

- **`docker`**: Dockerfile optimization and compose management.
- **`vp-chaos-toxiproxy`**: Operating Toxiproxy chaos toxics.
- **`vp-local-first-check`**: Verifying offline isolation with `docker-compose.offline.yml`.

---

## 4. Local Commands

```bash
# Start infrastructure containers
make up

# Start full stack (infra + API + workers)
make up-all

# Stop containers and remove volumes
make down

# Run offline smoke test
make smoke-offline

# Start observability profile (Prometheus, Grafana, Tempo, Loki)
make obs-up
```
