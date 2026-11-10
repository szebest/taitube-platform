# AGENTS.md - @vp/demo (server tier)

Instructions for any coding agent working on `packages/server/demo`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

## Orchestration (`pnpm demo`, `make demo`)

`pnpm demo [up|seed|reset|down|status|login <persona>|help]` starts the stack, seeds the demo world and prints
where everything is. `make demo` and its `demo-seed`, `demo-reset`, `demo-down`, `demo-status` and `demo-login` siblings call `scripts/demo.sh`, a bootstrap that works before `pnpm install`
(checks Node 24, pnpm 12, Docker, Compose v2, ffmpeg, installs when `node_modules` is stale, creates `.env`)
and then runs `pnpm --silent demo`. Exit codes: 0 ok, 1 failure, 2 bad usage, 3 prerequisite missing.

- `src/option-table.ts` owns every flag, env var and default (`FLAGS`, `DEFAULTS`, `PROFILE_DEFAULTS`) and
  generates the help text from them; `src/options.ts`'s `parseDemoCommand` returns a tagged `DemoCommand` or a one-line usage error
  (exit 2). A flag beats its env var. A new option is a new `FLAGS` row, nothing else.
- `src/targets.ts` turns options into `pnpm stack up` targets (`minimal`: `api web studio` plus the stages
  `worker:probe|transcode|thumbnail|package|notify|housekeeping|screen`; with workers on, `--only` still adds `api` and the stages, because the seed waits for READY; `full`: `all`; `observability` on request) and
  the ports a run needs. The stack resolves infra and migrate through compose `depends_on`: never list them here.
- `src/prereqs.ts` runs the checks in parallel and names a holder (via `lsof`) for any needed port that this
  compose project does not publish itself; hints are per macOS, Linux and WSL.
- `src/orchestrate.ts` is the five steps (prerequisites, `.env`, stack, seed, table) and the other commands,
  all over the `DemoHost` port in `src/host.ts`; `src/plan.ts` is the `--dry-run` text; `src/cli.ts` dispatches;
  `src/main.ts` is the only file touching `child_process`, `fs` and `fetch`. The seed is injected (`SeedFn`).
- `src/state.ts` keeps `.demo/state.json` (options, timestamps, last seed report); `.demo/media` is the clip
  cache `reset` keeps unless `--purge-media`. `.demo/` is git-ignored and nothing is written outside it.
- `src/logins.ts` names the four demo personas (viewer, creator, moderator, admin) over `DEV_PERSONAS` from
  `@vp/dev-token`, which owns the ids and roles, and holds the `vp.session` cookie name, copied from `@vp/queries`
  because a server package may not import a client one. Tokens come from `pnpm dev-token mint`. The ids and
  roles must equal what the seed creates.
- The summary table prints `ADMIN_TOKEN` and `S3_SECRET_ACCESS_KEY` only when `heldLocalCredentials`
  (`@vp/env-schema`) knows the value, else `see .env`: a `.env` pointed at R2 never leaks into a terminal.
- `down` runs `docker compose stop`, so volumes survive and the next `up` is quick; `reset` is `pnpm stack down`
  (volumes deleted) plus the state, then `up`.

Tests: every file has a spec; orchestrator branches run against `__tests__/fake-host.ts`, no real Docker. The
bootstrap is covered by `scripts/__tests__/demo-sh.test.ts`.

Sign-in: `pnpm demo login <persona>` prints a token, a curl line and a DevTools cookie one-liner, and is the path on
the compose stack. The one-click persona buttons on `/login` (`VITE_DEMO_PERSONAS`, `SSR_DEV_TOKEN_URL`) exist under
`pnpm dev` only: the compose images are built without them.

## Seed (`src/seed/`)

`seedDemo(options, host, ports?)` (`src/seed/index.ts`) builds a deterministic world and creates it **as a
client of the public API**, signed in with dev tokens (`mintToken`, `AUTH_MODE=dev`), so every video goes through
the real pipeline (upload, probe, screen, transcode, thumbnail, package, READY) and every comment, reaction,
playlist and report goes through the real services. The one write outside the API is `upsertIdentities`
(`@vp/db/seed-identities`): no route grants a role or a tier, and the database needs `host.databaseUrl`.
Re-running it adds nothing: each step looks before it creates. It refuses `host.environment === 'production'`.

- `SeedHost` carries `log`, `databaseUrl` (`DATABASE_URL`), `cdnBaseUrl`, `environment` and `storageAliases`.
  The compose API signs presigned URLs for `minio:9000`, which only the compose network resolves, so the
  default alias sends those requests to `localhost:9000` and keeps the signed `Host` header (`node:http`, since
  `fetch` forbids setting it). `ports` (`SeedPorts`: fetch, files, clock, uploader, ffmpeg, identities, contract
  routes, token signer) is injected, so every spec runs on fakes and the in-process `__tests__/fake-api.ts`.
- **World** (pure, from `options.seed` alone): `rng.ts` (mulberry32, `deriveSeed` per stream), `catalog.ts` (word
  banks), `world-users.ts`, `world-videos.ts`, `world-engagement.ts`, assembled by `world.ts`. The viewer
  (`...0002`), creator (`...0001`) and admin (`...000a`) ids equal `@vp/dev-token`'s personas, the moderator
  (`...000b`, `MODERATOR`) has no dev persona; extra creators and fans follow. A spec hashes the seed 1729 world:
  changing a bank or a draw order changes every demo world and the hash with it, on purpose.
- **Media** (`media.ts`): clips come from `lavfi` sources (`testsrc2`, `gradients`, `life`, `mandelbrot`,
  `cellauto`, `smptebars`, `rgbtestsrc`) plus a `sine` tone, no text overlay (not every ffmpeg has `drawtext`),
  `+bitexact` and one thread, so the same spec renders the same bytes. The cache key is the hash of the clip
  spec; a re-run reuses `.demo/media`. Standard clips are 640x360, Shorts 360x640 (the API derives the format
  from a portrait probe).
- **Scenarios** run in order, one log line each (`done|skipped|failed <name>: <detail>`). `requires` is checked
  against `packages/universal/api-contracts/openapi.yaml` (`openapi-routes.ts`): a missing route is
  `skipped <name>: needs <route> (not in this build)`, and so is a 404 or 501 at run time. A scenario never
  throws; a failed one is `failed` and the run goes on, except the essential `identities` and `channels`.
  `needsReady` scenarios are skipped with `withWorker: false`, which also skips the READY wait.

| Scenario | Routes it needs |
| --- | --- |
| identities (db) | none |
| categories | `GET /v1/categories`, `POST /v1/admin/categories` (no migration creates categories) |
| channels | `GET /v1/me/account` (first request provisions the channel), `PATCH /v1/me/channel` |
| channel-images | `POST /v1/me/channel/images/{kind}/upload` and `/complete` |
| media | none (ffmpeg) |
| videos | `POST /v1/uploads`, `GET /v1/creator/videos`, `GET /v1/videos/{id}`, `PATCH /v1/creator/videos/{id}` |
| captions | `GET /v1/videos/{id}/captions`, `PUT /v1/videos/{id}/captions/{lang}` (a generated WebVTT) |
| comments | `GET`/`POST /v1/videos/{id}/comments`, `GET /v1/comments/{id}/replies`, `POST /v1/comments/{id}/pin` and `/heart` |
| reactions | `GET /v1/videos/{id}/reactions/me`, `PUT /v1/videos/{id}/reactions` |
| subscriptions | `GET`/`POST /v1/channels/{id}/subscribers`(`/me`) |
| playlists | `GET /v1/me/playlists`, `POST /v1/playlists`, `GET /v1/playlists/{id}`, `POST /v1/playlists/{id}/items` |
| history | `GET /v1/me/history/{videoId}`, `POST /v1/me/history` |
| searches | `GET /v1/search`, `GET /v1/me/searches` |
| reports | `POST /v1/comments/{id}/reports` (a second report is a 409, counted as there) |
| featured | `GET /v1/channels/{id}/featured`, `PUT /v1/me/channel/featured`, the spotlight pair when listed |

- **Videos**: titles are looked up per owner (`GET /v1/creator/videos`), so an existing title is not uploaded
  again; an upload a failed run left in `UPLOADING` is deleted and redone. Uploads run two per owner, a 429 backs
  off. Metadata (title, description, category, tags, visibility) is set after READY with the `version` the
  API wants, because the pipeline moves it. With `SCREENING_ENABLED=true` the screening model holds some of the
  synthetic clips (`HELD`), so the seed approves them as the admin; the stack therefore needs `worker:screen`,
  or no video ever leaves `PROCESSING`.
- **Out of scope**: anything that needs a `created_at` in the past (history over days, trending decay), view
  counts, live streams, watch parties, webhooks. The API clock is the only clock.
- A new scenario is a file in `scenarios/`, a line in `scenarios/index.ts`, a spec, and a row above. Its
  `requires` must be routes the committed contract lists today (`scenarios/__tests__/index.test.ts` checks).
