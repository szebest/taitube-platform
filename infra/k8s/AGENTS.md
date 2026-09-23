# AGENTS.md — infra/k8s (Kubernetes & KEDA Orchestration)

Instructions for any coding agent working on Kubernetes manifests and autoscaling (`infra/k8s`).

---

## 1. Scope & Topology

`infra/k8s` contains the declarative Kubernetes resources organized using Kustomize:

- `infra/k8s/base/`: Common manifests for API Deployments, Service definitions, Ingress, Worker Deployments (`probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`), and KEDA `ScaledObject` resources.
- `infra/k8s/overlays/local/`: Local k3d/kind overlay with in-cluster dependencies and nodePort/hostPort mappings.
- `infra/k8s/overlays/cloud/`: Production cloud overlay targeting external managed services (Neon PostgreSQL, Cloudflare R2, secrets through an `ExternalSecret`).
- `infra/k8s/helm-values/`: Configuration values for cluster addons (KEDA, Traefik).

---

## 2. Invariants & Rules

1. **KEDA Queue Autoscaling:** Worker Deployments autoscale based on BullMQ queue depth (`waiting + active`) using KEDA `ScaledObject` triggers.
   - Scale-to-zero: Workers scale to 0 when queues are empty.
   - Scale-in Protection: Grace periods (`terminationGracePeriodSeconds: 300`) must allow in-flight video transcodes to finish.
2. **Resource Boundaries:** Every container MUST specify explicit `resources.requests` and `resources.limits` for CPU and memory.
3. **Kustomize Discipline:** Never duplicate manifest definitions; place base specs in `base/` and apply transformations in overlays (`kustomization.yaml`).
4. **Validation:** All manifests must validate against Kubernetes schemas via `scripts/validate-k8s.sh`.

---

## 3. Dedicated Skills

- **`vp-keda-queue-autoscaling`**: KEDA trigger definitions and autoscaling mechanics.

---

## 4. Local Commands

```bash
# Create local k3d cluster with Helm addons
make k3d-up

# Deploy application and workers via Kustomize
make k3d-deploy

# Validate manifests against kubeconform
scripts/validate-k8s.sh

# Tear down local k3d cluster
make k3d-down
```
