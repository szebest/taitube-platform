# This repo

The rule: root `AGENTS.md` rule 1, `docs/PRD.md` G11 and FR-19, `docs/SDD.md` P9 and
§12.1. The guide, including what may touch the network: `docs/LOCAL_FIRST.md`.

- **Machine-checked already** (`tests/architecture/local-first.test.ts`): no external host
  in production source, no stylesheet or font from another host in the web app, nothing
  loaded from another host by the web document, and every uncommented `.env.example`
  default on this machine. The checklist covers what it cannot see: images, telemetry
  defaults of a new library, docs.
- **Phone-home flags**: `TURBO_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` in `.env.example`
  and CI.
- **Local auth**: `AUTH_MODE=dev` with an empty `AUTH_JWKS_URL`, tokens from
  `pnpm dev-token mint`.
- **Local observability**: `make up all observability`.
- **Offline smoke**: `make smoke-offline` layers `infra/compose/docker-compose.offline.yml`
  on the base file, asserts the block with `scripts/assert-no-egress.sh`, then runs
  `scripts/e2e-smoke.sh` and the browser suite. CI's `e2e-smoke` job runs on every PR that
  changes code.
- **The cloud rung** (R2, Neon, Grafana Cloud, Cloudflare) is optional and switched by
  environment alone.
