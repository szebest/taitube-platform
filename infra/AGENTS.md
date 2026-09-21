# AGENTS.md — infra (Infrastructure Topologies & Deployment)

Instructions for any coding agent working on infrastructure, orchestration, and deployment (`infra/`).

---

## 1. Scope & Architecture

`infra/` contains the container definitions, orchestration manifests, and infrastructure-as-code for `video-pipeline`:
- **Docker Compose (`infra/compose`):** Primary local developer environment and offline CI smoke test harness.
- **Kubernetes (`infra/k8s`):** Production-grade declarative manifests organized with Kustomize (`base/`, `overlays/local` for k3d, `overlays/cloud` for cloud clusters).
- **Terraform (`infra/terraform`):** Cloud infrastructure-as-code for Cloudflare R2 object storage, custom domain DNS, API tokens, and Cloudflare Tunnel.

---

## 2. Core Infrastructure Invariants

1. **Local-First Baseline:** The system must run completely offline without internet connectivity. External cloud services (R2, Neon, Grafana Cloud) are optional reference overlays and never hard dependencies.
2. **Deterministic Parity:** Local MinIO buckets (`raw`, `public`) mirror the exact object key layouts and permissions configured in Cloudflare R2 via Terraform.
3. **Queue Health & Durability:** Redis instances must run with `maxmemory-policy: noeviction` and append-only files (`appendonly: yes`) to prevent BullMQ job loss.
4. **Secret Management:** Secrets committed to git (e.g. in `infra/k8s/overlays/cloud/secrets.enc.yaml`) must be encrypted using SOPS and age. Plaintext secrets must never be committed.

---

## 3. Directory Index

- **Docker Compose:** [infra/compose/AGENTS.md](compose/AGENTS.md)
- **Kubernetes Manifests:** [infra/k8s/AGENTS.md](k8s/AGENTS.md)
- **Terraform IAC:** [infra/terraform/AGENTS.md](terraform/AGENTS.md)

---

## 4. Key Commands

```bash
# Start local Compose infrastructure
make up

# Start full local application stack
make up-all

# Create and deploy to local k3d Kubernetes cluster
make k3d-up && make k3d-deploy

# Validate Kubernetes manifests
scripts/validate-k8s.sh
```
