# AGENTS.md — infra (Infrastructure Topologies & Deployment)

Instructions for any coding agent working on infrastructure, orchestration, and deployment (`infra/`).

---

## 1. Scope & Architecture

`infra/` contains the container definitions, orchestration manifests, and infrastructure-as-code for `video-pipeline`:
- **Docker Compose (`infra/compose`):** Primary local developer environment and offline CI smoke test harness.
- **Kubernetes (`infra/k8s`):** Kustomize manifests (`base/`, `overlays/local` for k3d or kind, `overlays/cloud` for the k3s cloud node) plus Helm values for the in-cluster addons.
- **Terraform (`infra/terraform`):** Cloud infrastructure-as-code: Cloudflare R2 buckets, CDN domain, scoped API tokens, Tunnel and Access, and the Hetzner k3s server with its firewall.
- **Observability (`infra/observability`):** Grafana dashboards and Prometheus alert rules, mounted by the compose `observability` profile. The k8s base inlines its own copies in `dashboards-configmaps.yaml`.

---

## 2. Core Infrastructure Invariants

1. **Local-First Baseline:** The system must run completely offline without internet connectivity. External cloud services (R2, Neon, Grafana Cloud) are optional reference overlays and never hard dependencies.
2. **Storage Parity:** Local MinIO (`infra/compose/minio-init.sh`) and R2 (`infra/terraform/main.tf`) hold the same two buckets: raw is private with a 7-day expiry, public is readable (MinIO anonymous download, R2 through `cdn.<domain>`). The names differ (`raw`/`public` locally, `vp-raw`/`vp-public` on R2) and reach the code through `S3_BUCKET_RAW` / `S3_BUCKET_PUBLIC`; object keys come from `packages/server/storage/src/keys.ts`, not from infra.
3. **Queue Health & Durability:** Redis runs with `maxmemory-policy noeviction` and `appendonly yes` so BullMQ loses no job: set explicitly in compose and `infra/k8s/helm-values/redis.yaml`; the cloud overlay's `redis.yaml` sets `--appendonly yes` and relies on Redis's default `noeviction`. `make check-redis` asserts both against the compose container.
4. **Secret Management:** No cloud credential is committed, encrypted or not. The cloud overlay reads its secrets through an `ExternalSecret`, and `tests/architecture/production-secrets.test.ts` renders it to hold that no `Secret` value and no local credential reaches it.

---

## 3. Directory Index

- **Docker Compose:** [infra/compose/AGENTS.md](compose/AGENTS.md)
- **Kubernetes Manifests:** [infra/k8s/AGENTS.md](k8s/AGENTS.md)
- **Terraform IAC:** [infra/terraform/AGENTS.md](terraform/AGENTS.md)

---

## 4. Key Commands

```bash
# Start every compose service outside a profile (infra, migrate, API, workers), building images only if missing
make up

# The same, rebuilding the API and worker images first
make up-all

# Create and deploy to local k3d Kubernetes cluster
make k3d-up && make k3d-deploy

# Render both overlays and run kubeconform when available (scripts/validate-k8s.sh)
make k8s-validate
```
