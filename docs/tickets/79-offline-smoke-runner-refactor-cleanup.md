# 79: Offline smoke test runner refactor & CI configuration cleanup

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton (Maintenance & Hardening) |
| Issue | [#79](https://github.com/szebest/taitube-platform/issues/79) |
| Priority | P0 (High — Frontier Precedence: Must complete before Phase 5 Frontend tickets) |
| Size | S |
| Blocked by | 35 — Local-first offline mode |
| Blocks | — |
| Spec | [SDD §12.1 Offline mode](../SDD.md#121-rung-1-docker-compose-local-dev-phase-02) · [PRD G11 Local-first](../PRD.md#31-goals-mvp) · [PRD FR-19](../PRD.md#6-functional-requirements) |

**Status:** in-progress

## What to build
> [!IMPORTANT]
> **Frontier Priority Notice:** This ticket has P0 frontier precedence over Phase 5 frontend feature tickets (`36`+). Resolving offline runner hardening and CI configuration cleanup is required before proceeding with frontend tracks.

Audit, review, and carefully streamline the network configurations and diagnostic probing added during the offline smoke test stabilization initiative (ticket 35).

During the stabilization of offline E2E testing on native Linux runners, several defensive layers were introduced across `.github/workflows/ci.yml`, `Makefile`, `scripts/e2e-smoke.sh`, and `scripts/upload.sh`:
- Kernel `route_localnet=1` sysctl settings.
- Scoped NAT masquerading (`-d 172.16.0.0/12 -s 127.0.0.1 -j MASQUERADE`) run before and after compose startup.
- Direct bridge container IP fallback (`http://${API_IP}:3000`).
- Multi-host curl resolution (`RESOLVE_ARGS` covering `localhost`, `minio`, and `127.0.0.1`).
- Extended verbose network diagnostic dumps on health check failure.

While the pipeline is currently 100% green and fully resilient across dual runtimes and offline modes, some declarations (e.g. repeated iptables calls in the CI job) can potentially be cleaned up.

> [!WARNING]
> **Strict Revert on Failure Policy:**
> Offline networking on Linux runners with `internal: true` bridge networks is delicate due to kernel martian packet filtering, NAT boundaries, and Docker port forwarding semantics. If ANY proposed simplification or cleanup causes GitHub Actions CI checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) to fail, **immediately revert the changes to commit `239e5e3`**. Do not break working CI on `main`.

## Acceptance criteria
- [ ] Review `.github/workflows/ci.yml` and `Makefile` for redundant `iptables` or `sysctl` invocations.
- [ ] Confirm `scripts/e2e-smoke.sh` and `scripts/upload.sh` maintain both loopback and direct container IP fallback mechanisms without redundant logic.
- [ ] Verify that `make smoke-offline` passes locally and in CI with zero internet egress (`curl -s --connect-timeout 2 http://1.1.1.1` must fail from inside containers).
- [ ] Strict CI Barrier (DoD Rule 10): All workflow checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) MUST pass green on GitHub Actions before merging or marking done. If any check fails, revert immediately.

## Out of scope
- Changing the canonical `infra/compose/docker-compose.offline.yml` (`internal: true`).
- Changing core application runtime or Fastify/worker logic.
- Re-introducing removed scripts (e.g., `e2e-smoke-offline.sh`).

## Testing plan
1. Propose and test minimal cleanup on a feature branch.
2. Push branch and monitor GitHub Actions execution.
3. If all 5 jobs pass green: review diff, merge to `main`, and verify green on `main`.
4. If ANY job fails: revert immediately to `239e5e3`.

## Definition of Done
- [ ] All AC verified with green GitHub Actions run.
- [ ] If any failure occurs during attempt, clean revert confirmed.
- [ ] Ticket index regenerated via `python3 docs/tickets/gen-index.py`.
