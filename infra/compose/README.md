# Docker Compose Infrastructure (`infra/compose`)

This directory contains Docker Compose configurations for running the `video-pipeline` platform locally.

---

## Compose Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Primary compose file defining PostgreSQL 16, Redis 7, MinIO, migrate, the API, the worker stages and the web app, with one profile per app. |
| `docker-compose.offline.yml` | Network isolation overlay (`internal: true`) for testing offline operation (`make smoke-offline`). |
| `docker-compose.chaos.yml` | Routes a worker's Redis through toxiproxy for the readiness chaos run (`make chaos-readiness`). |
| `test.sh` | Infrastructure smoke checks (`make smoke-infra`). |

---

## Infrastructure Services

- **PostgreSQL 16**: Port `5432` (Database: `vp`, User: `vp`, Password: `vp`).
- **Redis 7**: Port `6379` (Password: `vp`, configured with `noeviction` and AOF durability).
- **MinIO**: API on port `9000`, Console UI on port `9001` (User: `minioadmin`, Password: `minioadmin`).
  - Buckets initialized automatically via `minio-init.sh`: `raw` (private) and `public` (download policy enabled).
- **Web app**: port `5173` (profile `web`).
- **Observability Stack** (via `make up observability`):
  - Prometheus: `:9090`
  - Grafana: `:3001` (Credentials: `admin`/`admin`)
  - Tempo: `:3200`
  - Loki: `:3100`
  - Alertmanager: `:9093`

---

## Commands

```bash
make up                   # Start Postgres, Redis and MinIO with its buckets; no migrate, API or workers
make up api               # The infrastructure, migrate and the API; web, worker and worker:<stage> likewise
make up all               # Build the images and start everything: infra, migrate, API, every worker stage and web
make status               # Every service, its state and its URL
make down                 # Stop all containers, every profile included, and remove volumes
make up observability     # Start observability profile
```

See [AGENTS.md](AGENTS.md) for coding agent guidelines.
