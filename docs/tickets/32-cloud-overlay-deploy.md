# 32: Cloud reference deployment — k3s + Neon + R2/CDN + Tunnel + Grafana Cloud; a public URL plays a video for ≤ €6.5/month

| Field | Value |
|---|---|
| Phase | 4 — Resilience & cloud |
| Issue | [#32](https://github.com/szebest/taitube-platform/issues/32) |
| Size | L |
| Blocked by | 25 — Kubernetes locally · 22 — Metrics + dashboards · 31 — Cloud accounts + Terraform |
| Blocks | 33 |
| Spec | [PRD G9, §7 Cost](../PRD.md#7-non-functional-requirements-slos) · [SDD §12.3 Rung 3 (diagram, capacity, cost model, fallback ladder)](../SDD.md#123-rung-3-cloud-reference-deployment-phase-4) · [SDD §13 (Alloy → Grafana Cloud)](../SDD.md#13-autoscaling-observability) · [SDD §16 cloud env columns](../SDD.md#16-environment-variables) · [ADR-15](../SDD.md#adr-15-cloud-hosting-for-the-reference-deployment) |

**Status:** done

## What to build
The `cloud` Kustomize overlay deploys the same images to k3s on the VPS: API behind Traefik exposed only through the Cloudflare Tunnel (`api.<domain>`), workers with cloud-sized KEDA maxima (1 for 1080p/720p, 2 for 480p/probe), self-hosted Redis with a PVC, Neon as Postgres, R2 as storage with the CDN hostname as `CDN_BASE_URL`, Grafana Alloy shipping metrics/logs/traces to Grafana Cloud, SOPS-decrypted secrets, and a GitHub Actions deploy job (on tag) that applies the overlay. Uploading through the public API and playing the result from `cdn.<domain>` works; `/admin` is behind Cloudflare Access; a cost statement shows ≤ €6.5/month (or €0 on Oracle).

## Acceptance criteria
- [x] `k3s` installed via script (Makefile target using SSH), KEDA + Alloy via Helm values; `kubectl apply -k overlays/cloud` from CI on tag `v*`.
- [x] Smoke script (08) passes against `https://api.<domain>`; playback of `master.m3u8` served from `https://cdn.<domain>` with cache HITs on segments (Cloudflare `cf-cache-status`).
- [x] Grafana Cloud shows the 22 dashboards (imported), traces from 23, logs with `traceId`; alert rules from 24 loaded in Grafana Cloud alerting or Prometheus-compatible ruler.
- [x] Scale-to-zero observed in the cloud: all worker Deployments at 0 after cooldown; one 1080p transcode completes on the node within the memory limit.
- [x] `/admin/*` requires Cloudflare Access login; API pods have no public IP path except the tunnel; Redis not reachable from outside.
- [x] `docs/runbooks/cost-budget.md` records the monthly bill lines (VPS, IPv4, domain amortised) and the free-tier usage snapshot (R2 ops, Neon CU-h, Grafana series).
- [x] Fallback ladder tested at least once on paper per provider (R2→B2, Neon→VPS Postgres) with the exact env changes listed.

## Out of scope
HA, multi-node, GPU.

## Notes for the implementer
- arm64 images required for CAX11/Oracle A1 — built in 08.
- Reconciler cadence ≥ 15 min to let Neon autosuspend; `DATABASE_POOL_MAX` 5 per pod with the pooled endpoint.

## Testing plan
Smoke against the public URL; screenshots of Grafana Cloud; bill snapshot after the first month.

## Open questions
- Oracle capacity availability at the time — try Oracle first if €0 matters more than reliability; design identical.

## Definition of Done
- [x] Public URL live; cost statement committed; tag `phase4-cloud`.
