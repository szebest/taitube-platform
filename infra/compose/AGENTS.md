# AGENTS.md — infra/compose (Docker Compose Topologies)

Instructions for any coding agent working on Docker Compose manifests (`infra/compose`).

---

## 1. Scope & Manifests

`infra/compose` defines the containerized environments for local development, CI testing, and observability:
- `docker-compose.yml`: one file. The app services build from the root `Dockerfile` (`target: api`,
  `worker`, `web`); workers build with `WORKER_RUNTIME` (default `bun`). Every service's dependencies are its
  `depends_on`, and nothing else lists them: `make up` (`pnpm stack`, `packages/server/stack`) reads them
  from `docker compose config` to decide what a target needs and in which order.
  - No profile, the infrastructure: PostgreSQL 16, Redis 7, MinIO and `minio-init` (runs `minio-init.sh`).
  - `migrate` (profile `migrate`): migrations, then seed, from `dist/migrate.js` and `dist/seed.js`.
  - `api` (profile `api`), after migrate and the buckets.
  - `web` (profile `web`): the TanStack Start SSR server on `:5173`, after a healthy `api`. The browser calls
    the API at the build-time `VITE_API_BASE_URL` (`http://localhost:3000`, the published port); the SSR
    server calls it on the compose network at `SSR_API_BASE_URL` (`http://api:3000`). Read-only root
    filesystem with a `/tmp` tmpfs, healthy when `/robots.txt` answers.
  - One service per worker stage (profile `worker`), after migrate and the buckets: `worker-probe`,
    `worker-transcode-1080p`, `worker-transcode-720p`, `worker-transcode-480p`, `worker-thumbnail`,
    `worker-package`, `worker-notify`, `worker-housekeeping`.
  - `observability`: Prometheus, Alertmanager, Grafana, Tempo, Loki and the OTel collector, configured from
    the folders beside the file and from `infra/observability/`.
  - `chaos`: Toxiproxy, proxying MinIO (`:9002`) and Redis (`:6380`) as `toxiproxy/toxiproxy.json` declares.
  - `tools`: `hls-test-page`, nginx serving `tools/hls-test-page` on `:8080`.
- `docker-compose.offline.yml`: overrides the default network with `internal: true`. `make smoke-offline`
  layers it on and asserts the API container cannot reach the internet.
- `docker-compose.chaos.yml`: points `worker-notify` at Redis through Toxiproxy, for `make chaos-readiness`
  (`scripts/chaos-readiness.sh`).
- `test.sh`: the infrastructure smoke run behind `make smoke-infra`.

---

## 2. Invariants & Rules

1. **Fast Healthchecks:** healthchecks poll fast so `up --wait` returns in seconds.
   - Postgres, Redis, the API (`/readyz`) and web (`/robots.txt`): `interval: 1s`, `timeout: 2s`, `retries: 30`.
   - Workers: `interval: 5s`, `retries: 6` against `/readyz` on their metrics port.
2. **Redis Durability:** the Redis command MUST keep `--appendonly yes --maxmemory-policy noeviction`
   (`make check-redis` asserts both).
3. **Build Caching:** the root `Dockerfile` builds the three images and does this, in this order (keep it):
   - run `turbo prune --docker` once for the three apps together and once per app;
   - install once, from the joint pruned manifests, before copying any source (the `deps` stage all three
     share);
   - build each app from its own pruned source (`build-api`, `build-worker`, `build-web`), so a change to one
     app's source leaves the other two images' layers cached;
   - mount the shared `pnpm-store` BuildKit cache for `pnpm install` and the turbo build.
   `scripts/bundle-app.sh` writes what an image copies. CI builds the bundles on the runner and hands them to
   the `api-bundle`, `worker-bundle` and `web-bundle` stages as build contexts.
4. **Clean Volume Mounts:**
   - Named volumes (`pgdata`, `redisdata`, `miniodata`) hold local state outside the checkout.
   - Workers get a `/tmp/vp` tmpfs.
   - `make down` and `make nuke` both remove the volumes.

---

## 3. Dedicated Skills

- **`docker`**: Dockerfile optimization and compose management.
- **`vp-chaos-toxiproxy`**: Operating Toxiproxy chaos toxics.
- **`vp-local-first-check`**: Verifying offline isolation with `docker-compose.offline.yml`.

---

## 4. Local Commands

```bash
# Start Postgres, Redis and MinIO with its buckets; no migrate, API or workers
make up

# Build and start one app and what it needs: api, web, worker, worker:<stage>
make up web

# Build the images and start everything: infra, migrate and seed, API, every worker stage and web
make up all

# Every service, its state and its URL
make status

# Stop every service, every profile included, and remove volumes
make down

# Run offline smoke test
make smoke-offline

# Start the observability profile
make up observability

# Start Toxiproxy (chaos profile)
make toxiproxy-up
```
