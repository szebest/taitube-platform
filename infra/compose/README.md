# Docker Compose Infrastructure (`infra/compose`)

This directory contains Docker Compose configurations for running the `video-pipeline` platform locally.

---

## Compose Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Primary compose file defining PostgreSQL 16, Redis 7, MinIO, API, and worker stages. |
| `docker-compose.offline.yml` | Network isolation overlay (`internal: true`) for testing offline operation (`make smoke-offline`). |
| `docker-compose.toxiproxy.yml` | Toxiproxy sidecar overlay for simulating storage/network chaos. |

---

## Infrastructure Services

- **PostgreSQL 16**: Port `5432` (Database: `vp`, User: `vp`, Password: `vp`).
- **Redis 7**: Port `6379` (Password: `vp`, configured with `noeviction` and AOF durability).
- **MinIO**: API on port `9000`, Console UI on port `9001` (User: `minioadmin`, Password: `minioadmin`).
  - Buckets initialized automatically via `minio-init.sh`: `raw` (private) and `public` (download policy enabled).
- **Observability Stack** (via `make obs-up`):
  - Prometheus: `:9090`
  - Grafana: `:3001` (Credentials: `admin`/`admin`)
  - Tempo: `:3200`
  - Loki: `:3100`
  - Alertmanager: `:9093`

---

## Commands

```bash
make up          # Start database, redis, and storage
make up-all      # Start everything including API and transcode workers
make down        # Stop all containers and remove volumes
make obs-up      # Start observability profile
```

See [AGENTS.md](AGENTS.md) for coding agent guidelines.
