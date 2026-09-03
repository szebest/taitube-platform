# 35: Local-first proof — the whole system runs with **zero external services and no internet** (Phase 1 exit criterion)

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton (exit gate; number is dependency-order, not priority — do this right after 08) |
| Size | S–M |
| Blocked by | 08 — Containerise + compose |
| Blocks | — |
| Spec | [PRD G11 Local-first](../PRD.md#31-goals-mvp) · [PRD FR-19](../PRD.md#6-functional-requirements) · [PRD §7 Portability / Local-first](../PRD.md#7-non-functional-requirements-slos) · [SDD §1.3 P9](../SDD.md#13-design-principles-used-to-break-ties-throughout) · [SDD §12.1 Offline mode](../SDD.md#121-rung-1-docker-compose-local-dev-phase-02) · [SDD §15.3 (accounts are Phase 4 only)](../SDD.md#153-external-services-accounts-to-create-all-free-unless-noted) |

**Status:** done

## What to build
After images and npm dependencies have been fetched once, a developer disconnects from the network entirely and the full system still works: `make up-all`, upload, probe, transcode, package, SSE, playback in the test page, Bull Board, `/docs`, and (once 21 exists) the observability profile — with no call ever leaving the machine. A CI job proves it by running the smoke test inside a Docker network with `internal: true` (no egress). Anything that would phone home (a CDN-loaded script, an OTel exporter with a public default endpoint, a telemetry beacon in a library, image pulls at runtime) is removed or vendored. The dev JWT issuer, MinIO, Postgres and Redis are the *only* auth/storage/data services required for local development; every external account in SDD §15.3 is strictly for the optional cloud rung.

## Acceptance criteria
- [x] `make smoke-offline`: starts everything on a compose network marked `internal: true` (plus a one-off allowance for `localhost` port publishing), runs the 08 smoke, passes. Runs in CI on every PR that touches `infra/` or Dockerfiles.
- [x] hls.js and any other browser library in the test page are vendored into the repo (pinned version, license kept) — no `cdnjs`/`unpkg` references remain in local tooling.
- [x] OTel exporters are no-ops when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty (verified with a network capture / collector logs showing zero outbound attempts); no library telemetry (e.g. Turborepo, Prisma-style) is enabled — `TURBO_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1` set in `.env.example` and Dockerfiles.
- [x] Runtime images contain everything they need (FFmpeg, fonts for `drawtext` if used by fixtures) — no `apt`/`npm` at container start; compose uses no `pull_policy: always`.
- [x] A `docs/LOCAL_FIRST.md` page (linked from README) states plainly: what runs locally (everything), what needs the internet (initial `pnpm install` + image pulls, optional cloud rung, optional Grafana Cloud), and how to work fully offline.
- [x] `.env.example` defaults are all-local and work with no edits (already true; add a test that boots API + a worker with the unmodified example file).

## Out of scope
Offline *installation* (an initial `pnpm install` and image pull need the network once); air-gapped npm mirrors.

## Notes for the implementer
- `docker network create --internal` blocks egress but allows inter-container traffic; port publishing to the host still works for the test page/browser.
- If the fixture generator needs a font for `drawtext`, bake `fonts-dejavu-core` into the worker image rather than downloading at runtime.

## Testing plan
`make smoke-offline` locally and in CI; a manual "Wi-Fi off" walkthrough recorded in `LOCAL_FIRST.md`.

## Open questions
- None — everything at runtime is already local by design; this ticket enforces and proves it.

## Definition of Done
- [x] Offline smoke green in CI; `LOCAL_FIRST.md` merged; no remote asset references in local tooling.
