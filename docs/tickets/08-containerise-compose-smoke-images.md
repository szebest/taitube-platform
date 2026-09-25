# 08: Containerise everything — `make up-all && make smoke` from a fresh clone (Phase 1 exit)

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Issue | [#8](https://github.com/szebest/taitube-platform/issues/8) |
| Size | M |
| Blocked by | 07 — Playable READY video · 02 — CI |
| Blocks | 21, 25, 34, 35, 80 |
| Spec | [SDD §12.1 Compose (full outline + worker Dockerfile)](../SDD.md#121-rung-1--docker-compose-local-dev-phase-02) · [SDD §11 Containers](../SDD.md#11-security) · [SDD §2.3 `WORKER_RUNTIME` guard-rail](../SDD.md#23-runtime-split--why-two-runtimes) · [PRD §9 Success metrics](../PRD.md#9-success-metrics) · [SDD §18 Phase 1 DoD](../SDD.md#phase-1--walking-skeleton--2-weeks) |

**Status:** done

## What to build
Someone with only Docker installed clones the repo, runs `make up-all`, then `make smoke`, and within ten minutes sees an uploaded synthetic video reach `READY` and its playlist fetched successfully — no local Node/Bun/FFmpeg required. Images for `api` (Node 24 slim, non-root) and `worker` (single image, `WORKER_RUNTIME=bun|node` build arg, FFmpeg + tini, non-root, read-only root FS, tmpfs for `/tmp/vp`) are built multi-arch (amd64 + arm64) in CI and pushed to GHCR with Trivy scanning; compose gains `api`, `migrate`, one service per worker stage (`WORKER_STAGE` env only), and the `tools` profile for the test page.

## Acceptance criteria
- [x] `make up-all` (infra + migrate + api + all worker stages) healthy in < 3 min after images are built; `make smoke` runs `scripts/e2e-smoke.sh`: upload `s15` → poll until `READY` (timeout 5 min) → `curl` master + one segment → exit 0.
- [x] `docker buildx build --platform linux/amd64,linux/arm64` succeeds for both images; `images.yml` pushes `ghcr.io/<owner>/vp-api` and `vp-worker` tagged by git sha + `latest` on `main`; Trivy fails the job on CRITICAL CVEs (allowlist file exists).
- [x] Worker image built with `WORKER_RUNTIME=node` passes the same smoke; image size documented for both variants.
- [x] Containers run as non-root, root FS read-only, `/tmp/vp` tmpfs sized; `tini` is PID 1 and `SIGTERM` reaches the worker (drain observed in logs).
- [x] `make smoke` runs in CI as an `e2e` job using the locally built images.

## Out of scope
Observability profile (21), Kubernetes (25). The offline/no-egress proof is ticket 35 — do it immediately after this one; together they are the Phase 1 exit.

## Notes for the implementer
- Use `pnpm deploy --prod` for slim runtime layers; never bake `.env` into images.
- Pin base images by digest in the Dockerfiles once Renovate is confirmed to update them.

## Testing plan
The smoke script is the test; CI `e2e` job; manual arm64 run if a Mac is available.

## Open questions
- None.

## Definition of Done
- [x] Tag `phase1-done`; README "Run everything in Docker" verified by a second person/agent from a clean machine.
