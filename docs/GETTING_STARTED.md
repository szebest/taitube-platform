# Getting started

From a fresh clone to a running platform with a believable demo world in five commands. Everything runs on your
machine, with no account and no internet after the first image build (local-first, [LOCAL_FIRST.md](LOCAL_FIRST.md)).

```bash
git clone https://github.com/szebest/taitube-platform.git && cd taitube-platform
make demo                        # prerequisites, install, stack, migrate, seed, then a table of URLs and logins
make demo-login PERSONA=creator  # a token, a curl line and a DevTools snippet to sign in as a persona
make demo-status                 # the stack, the URLs and the last seed summary
make demo-down                   # stop the containers, keep the data (the next make demo is instant)
```

`make demo-reset` wipes the data and starts over. That is the whole loop.

## What `make demo` does

| Step | What happens | Skipped when |
|---|---|---|
| 1 Prerequisites | Node 24, pnpm 12, a reachable Docker daemon, Compose v2, ffmpeg, free disk, free ports; each failure names the fix for your OS | never |
| 2 `.env` | copied from `.env.example` when absent, never overwritten | `.env` exists |
| 3 Stack | `pnpm stack up` starts a tier at a time (infrastructure, migrate and bucket setup, API and workers, web and studio), each gated on health, building images only when needed | containers already healthy |
| 4 Seed | a deterministic world through the real API: users, channels, videos through the real pipeline, comments, playlists, subscriptions | every item already exists (a re-run adds nothing) |
| 5 Table | URLs, credentials and the personas | never |

State lives in `.demo/` (git-ignored) and in Docker volumes. Nothing else on your machine is touched.

## Prerequisites

| | macOS | Linux (Debian, Ubuntu) | Windows |
|---|---|---|---|
| Node 24 | `brew install node@24` | [nodejs.org](https://nodejs.org) or `nvm install 24` | use WSL 2, then the Linux column |
| pnpm 12 | `corepack enable` (the repo pins the version) | `corepack enable` | in WSL |
| Docker with Compose v2 | Docker Desktop, or `brew install colima docker docker-compose docker-buildx` then `colima start --cpu 6 --memory 12 --disk 40` | Docker Engine and the compose plugin | Docker Desktop with the WSL 2 backend |
| ffmpeg | `brew install ffmpeg` | `apt install ffmpeg` | in WSL |

Plan for about 8 GB of RAM for Docker, 20 GB of disk for images and build cache, and a few minutes for the first
image build. Later runs reuse the Docker layer cache and rebuild nothing that has not changed.
More detail on ffmpeg builds and Colima is in the README prerequisites.

## What you get

| Service | URL | Notes |
|---|---|---|
| Web app | http://localhost:5173 | the viewer app |
| Creator studio | http://localhost:5174 | upload, library, analytics |
| API | http://localhost:3000 | `/healthz`, `/readyz` |
| API docs | http://localhost:3000/docs | Scalar UI; JSON at `/openapi.json` |
| Bull Board | http://localhost:3000/admin/queues | send the `x-admin-token` header, value `ADMIN_TOKEN` from `.env` |
| MinIO console | http://localhost:9001 | `minioadmin` / `minioadmin` |
| MinIO S3 and the public bucket | http://localhost:9000 | HLS is served from `/public` |
| Postgres | `localhost:5432` | `make psql` |
| Redis | `localhost:6379` | `make redis-cli` |
| Grafana | http://localhost:3001 | only with `--observability`, `admin` / `admin` |
| Live RTMP and WHIP | `rtmp://localhost:1935/live`, http://localhost:8889/live | full profile only |

The authoritative list for your run is the table `make demo` prints and `make demo-status` repeats.

## Options

Every option is a flag after `ARGS=` or an environment variable; a flag wins.

```bash
make demo ARGS="--profile full --videos 24"
DEMO_VIDEOS=3 DEMO_SEED=7 make demo
make demo ARGS="--dry-run"          # print the plan, run nothing
```

| Flag | Env | Default | Meaning |
|---|---|---|---|
| `--profile minimal\|full` | `DEMO_PROFILE` | minimal | minimal: infrastructure, API, web, studio and the core worker stages; full: every service (captions, screening models, live) |
| `--videos <n>` | `DEMO_VIDEOS` | 8 (24 full) | videos uploaded through the real pipeline |
| `--users <n>` | `DEMO_USERS` | 12 (30 full) | users in the world |
| `--channels <n>` | `DEMO_CHANNELS` | 4 (8 full) | channels |
| `--seed <n>` | `DEMO_SEED` | 1729 | same seed, same world, byte for byte |
| `--no-worker` | `DEMO_WITH_WORKER=0` | on | no worker stages: no video reaches READY, and the steps that need one are skipped |
| `--reset` | `DEMO_RESET=1` | off | wipe the stack volumes and the state first |
| `--observability` | `DEMO_OBSERVABILITY=1` | off | add Prometheus, Grafana, Tempo and Loki |
| `--only web\|studio\|api` | none | all three | start only these apps (repeatable) |
| `--api-url <url>` | `DEMO_API_URL` | http://localhost:3000 | where the seed reaches the API |
| `--no-build` | none | off | skip the image build when the images exist |
| `--purge-media` | none | off | with a reset, also delete the generated clip cache |
| `--dry-run` | none | off | print the plan |

Exit codes: 0 ok, 1 failure, 2 bad usage, 3 prerequisite missing. `pnpm demo --help` prints the same table.

| Command | Does |
|---|---|
| `make demo` / `pnpm demo` | up: start and seed, safe to re-run |
| `make demo-seed` | seed a stack that is already running; idempotent |
| `make demo-reset` | delete volumes and state, then up |
| `make demo-down` | stop, keep the data |
| `make demo-status` | stack table, URLs, last seed summary |
| `make demo-login PERSONA=admin` | token, curl line, cookie snippet |

## Run only the API

```bash
make demo ARGS="--only api"      # infrastructure, migrate, API and the worker stages, no web or studio
# or without the demo world:
cp .env.example .env && make up api && pnpm db:migrate && pnpm db:seed
curl -s http://localhost:3000/healthz
```

## Sign in as a persona

The apps read the `vp.session` cookie. `make demo-login PERSONA=<viewer|creator|moderator|admin>` prints a dev token,
a `curl` line and a one-liner for the browser console on http://localhost:5173 or :5174 (one cookie serves both).
Under `pnpm dev` the apps also offer one-click persona buttons on `/login` (`VITE_DEMO_PERSONAS`, see
[ENVIRONMENT.md](ENVIRONMENT.md)). Production builds refuse it.

## Reset and clean up

```bash
make demo-reset                 # volumes and demo state gone, clips cache kept, then up again
make demo-reset ARGS="--purge-media"
make down                       # stop everything and delete every volume
make prune                      # reclaim Docker disk space
```

## Point at Cloudflare R2 later

Storage is S3-compatible. Set the `S3_*` and `CDN_BASE_URL` keys in `.env` to your R2 account (the commented R2 block
in `.env.example` lists them), keep `S3_FORCE_PATH_STYLE=false`, then run `make test-r2` to check the contracts.
For a real environment follow [DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Docker daemon not reachable` | start Docker Desktop, or `colima start`; then re-run |
| `port 5432 is held by ...` | another Postgres or an older stack: stop it, or `make down` in the other checkout |
| `no space left on device` while building | free Docker space with `make prune`, or grow the Colima disk: `colima stop && colima start --disk 60` |
| `No such filter: 'drawtext'` | only `pnpm gen-video` needs it; the demo clips do not. See the README ffmpeg section |
| Videos stay `PROCESSING` | a worker stage is missing: `make status`; the screen stage is required unless `SCREENING_ENABLED=false` |
| Some demo videos are held for review | the screening model flags synthetic clips now and then; the seed approves them as admin, or approve them in the studio |
| `OOM command not allowed` from Redis | an old Redis volume full of stale queues: `make down` and start again |
| `migrate` fails with an enum or relation error | a database volume from an older checkout: `make demo-reset` |
| Web shows an empty feed | the seed has not finished or `--no-worker` was used: `make demo-status`, then `make demo-seed` |
| Wrong Node or pnpm | `node -v` must say v24, `pnpm -v` 12; `corepack enable` |
| The full profile warns about models | captions and screening models are downloaded at image build time; on a host run use `pnpm models:fetch` once |

## FAQ

**Does it need the internet?** Only to pull base images and packages the first time. The seed generates its clips
with ffmpeg test sources and runs offline; `make smoke-offline` proves the apps do.

**Is the demo data the same every time?** Yes for one `--seed`: names, titles, clips, comments and likes. Timestamps are
the day you seed.

**Can I add my own videos?** `pnpm upload-client <file> --title "..." --token "$(pnpm --silent dev-token mint --raw)"`.

**Where is the demo world described?** [DEMO.md](DEMO.md): personas, a guided tour, how to extend the seed.

**Where is every environment variable?** [ENVIRONMENT.md](ENVIRONMENT.md), generated from the schema.

**How do I deploy?** [DEPLOYMENT.md](DEPLOYMENT.md).

## Keeping this page true

A change that adds an environment key, a service, a port, a seed entity or a demo scenario updates
[ENVIRONMENT.md](ENVIRONMENT.md) (`pnpm gen:env-docs`), this page and the seed in the same PR; the architecture suite
fails the key and `.env.example` parts, review holds the rest (the "Setup & environment" item in the PR template).
