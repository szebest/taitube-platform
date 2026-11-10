# AGENTS.md — @vp/demo (server tier)

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
  `worker:probe|transcode|thumbnail|package|notify|housekeeping`; `full`: `all`; `observability` on request) and
  the ports a run needs. The stack resolves infra and migrate through compose `depends_on`: never list them here.
- `src/prereqs.ts` runs the checks in parallel and names a holder (via `lsof`) for any needed port that this
  compose project does not publish itself; hints are per macOS, Linux and WSL.
- `src/orchestrate.ts` is the five steps (prerequisites, `.env`, stack, seed, table) and the other commands,
  all over the `DemoHost` port in `src/host.ts`; `src/plan.ts` is the `--dry-run` text; `src/cli.ts` dispatches;
  `src/main.ts` is the only file touching `child_process`, `fs` and `fetch`. The seed is injected (`SeedFn`).
- `src/state.ts` keeps `.demo/state.json` (options, timestamps, last seed report); `.demo/media` is the clip
  cache `reset` keeps unless `--purge-media`. `.demo/` is git-ignored and nothing is written outside it.
- `src/logins.ts` is the persona table (viewer, creator, moderator, admin) and the `vp.session` cookie name,
  copied from `@vp/queries` because a server package may not import a client one. Tokens come from
  `pnpm dev-token mint`. The ids and roles must equal what the seed creates.
- `down` runs `docker compose stop`, so volumes survive and the next `up` is quick; `reset` is `pnpm stack down`
  (volumes deleted) plus the state, then `up`.

Tests: every file has a spec; orchestrator branches run against `__tests__/fake-host.ts`, no real Docker. The
bootstrap is covered by `scripts/__tests__/demo-sh.test.ts`.

Dependency to wire once PR #326 (`VITE_DEMO_PERSONAS`, `SSR_DEV_TOKEN_URL`) merges: the one-click persona
buttons on `/login`. Until then `pnpm demo login <persona>` prints a token, a curl line and a DevTools cookie
one-liner; when #326 lands, set those two keys in the `.env` that `ensureEnv` creates and print the button hint.
