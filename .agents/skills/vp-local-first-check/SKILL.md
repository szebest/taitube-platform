---
name: vp-local-first-check
description: Enforce the video-pipeline local-first rule (PRD G11/FR-19, SDD P9) — verify that a change adds no runtime dependency on external services, that .env.example defaults stay all-local, that nothing phones home (telemetry, CDN scripts, default cloud endpoints), and that the full stack still passes the smoke test with network egress blocked. Use before merging any ticket, and for ticket 35.
license: MIT
metadata:
  project: video-pipeline
  spec: docs/PRD.md G11, FR-19; docs/SDD.md §1.3 P9, §12.1 Offline mode, §15.3
---

# Local-first check

The whole system must run on one machine with zero external accounts and no internet after a one-time `pnpm install` + image pull. External providers (R2/B2, Neon, Grafana Cloud, Cloudflare) exist **only** for the optional cloud rung.

## Review checklist (run on every PR)
- [ ] **No new external runtime dependency.** Grep the diff for hostnames: `grep -nE 'https?://[a-z0-9.-]+\.(com|net|io|dev|cloud|sh)' -r apps packages infra tools --include='*.{ts,js,json,yml,yaml,html,sh}'` — every hit must be either `localhost`/compose service name, documentation, or guarded behind a cloud-only env var that is empty by default.
- [ ] **`.env.example` still all-local**: values point at `localhost`/compose services; cloud values are commented; the `.env.example` drift test passes; booting API + one worker with the unmodified file works.
- [ ] **No phone-home**: `TURBO_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1` in `.env.example`, Dockerfiles and CI; OTel exporter is a no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty; no new library with telemetry enabled by default (check its docs; disable via env).
- [ ] **Vendored browser assets**: `tools/hls-test-page` and any HTML tooling load scripts from the repo, not `cdnjs`/`unpkg`/`jsdelivr`.
- [ ] **Images are self-contained**: no `apt-get`/`npm install`/`curl` at container start; FFmpeg, fonts and CA certs baked at build; compose has no `pull_policy: always`.
- [ ] **Auth stays local**: dev JWKS issuer (`tools/dev-token`) works; `AUTH_JWKS_URL` default is local.
- [ ] **Observability stays local**: compose `observability` profile (Prometheus/Grafana/Tempo/Loki/collector) covers everything the cloud overlay sends to Grafana Cloud.
- [ ] **Docs**: if something *does* need the internet (initial install, optional cloud), it is listed in `docs/LOCAL_FIRST.md`.

## Offline smoke (`make smoke-offline`)
1. `docker network create --internal vp-offline` (or a compose override with `networks: { default: { internal: true } }`) — blocks egress, keeps inter-container traffic and host port publishing.
2. Start the full stack on that network with the unmodified `.env.example` values (service hostnames instead of `localhost`).
3. Run the standard smoke (`scripts/e2e-smoke.sh`: upload `s15` → `READY` → fetch master + one segment).
4. Optional: `tcpdump -i any 'not net 172.16.0.0/12 and not host 127.0.0.1'` on the host during the run — zero packets expected.
5. Runs in CI on changes to `infra/`, Dockerfiles, or `tools/`.

## What is allowed to touch the network
| Activity | Needs internet? | Notes |
|---|---|---|
| `pnpm install`, `docker pull/build` | yes, once | cache in CI |
| `pnpm gen-video` | no | lavfi sources |
| Whole runtime (API, workers, SSE, playback, Bull Board, `/docs`, observability) | **no** | |
| Cloud rung (tickets 31–33) | yes | optional; env-only switch |
| Grafana Cloud k6 | yes | optional |

## If a capability cannot be provided locally
Do not adopt it for the MVP (PRD §8 constraint). Record the rejected option in the relevant ADR's "Revisit if" line instead.
