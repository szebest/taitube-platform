# 25: Kubernetes locally — Kustomize base + k3d overlay, Helm values; the smoke test passes on a cluster

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Size | L |
| Blocked by | 08 — Containerise + compose |
| Blocks | 26, 32 |
| Spec | [SDD §12.2 Rung 2 (manifests, Deployment essentials)](../SDD.md#122-rung-2-kubernetes-locally-kind-or-k3d-phase-3) · [SDD §15.1 `infra/k8s`](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §11 Containers](../SDD.md#11-security) |

**Status:** done

## What to build
`make k3d-up && make k3d-deploy && make smoke` brings up a local k3d cluster with in-cluster Postgres/Redis/MinIO (Helm), KEDA and kube-prometheus-stack installed (Helm values committed), applies the Kustomize `base` + `local` overlay (API Deployment with HPA, one Deployment per worker stage at 1 replica for now, Secrets/ConfigMap from the same `.env` contract, ServiceMonitors, dashboards as ConfigMaps), and the same smoke script from 08 passes against the cluster ingress.

## Acceptance criteria
- [x] `make k3d-up` creates the cluster and installs KEDA, kube-prometheus-stack, Redis, MinIO, Postgres via Helm with committed values in < 5 min.
- [x] `make k3d-deploy` applies migrations (Job), API and all worker Deployments; pods run non-root, read-only root FS, `emptyDir` for `/tmp/vp` with `sizeLimit`, resource requests/limits and `terminationGracePeriodSeconds` per stage as in SDD §12.2; `FFMPEG_THREADS` from `resourceFieldRef limits.cpu`.
- [x] `make smoke` green against the cluster; Grafana in-cluster shows the 22 dashboards via ConfigMaps.
- [x] `kustomize build overlays/local` and `overlays/cloud` (skeleton) both validate with `kubeconform`.
- [x] Worker liveness probe uses the heartbeat file; readiness for API hits `/readyz`.

## Out of scope
KEDA ScaledObjects (26), cloud overlay content (32).

## Notes for the implementer
- Prefer k3d; keep kind working via a Makefile variable.
- Images from GHCR (pinned by digest) or imported locally with `k3d image import` for dev.

## Testing plan
Smoke on cluster; `kubeconform` in CI for both overlays.

## Open questions
- None.

## Definition of Done
- [x] AC green; README "Run on Kubernetes locally".
