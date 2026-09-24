# AGENTS.md — infra/k8s (Kubernetes & KEDA Orchestration)

Instructions for any coding agent working on Kubernetes manifests and autoscaling (`infra/k8s`).

---

## 1. Scope & Topology

`infra/k8s` contains the declarative Kubernetes resources organized using Kustomize:

- `infra/k8s/base/`: namespace, the `vp-config` ConfigMap and `vp-secrets` Secret, the `vp-migrate` Job, the API Deployment, Service and Ingress, one worker Deployment per stage (`probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`, `housekeeping`), KEDA `ScaledObject`s for every worker, ServiceMonitors and the Grafana dashboard ConfigMaps.
- `infra/k8s/overlays/local/`: the k3d/kind overlay. It swaps the images for `vp-api:local` / `vp-worker:local` with `imagePullPolicy: IfNotPresent`, sets `NODE_ENV=development` and `AUTH_MODE=dev`, and adds a placeholder `ADMIN_TOKEN` that `make k3d-deploy` replaces with the git-ignored `secrets.env` value. Postgres, Redis and MinIO come from Helm, not from the overlay.
- `infra/k8s/overlays/cloud/`: the cloud overlay. It deletes the base `Secret` for an `ExternalSecret` (database URL, Redis password, R2 endpoint and keys, Grafana OTLP, tunnel token), adds an in-cluster Redis, `cloudflared` and Grafana Alloy, patches the ConfigMap for R2, JWKS auth and CORS, and lowers `maxReplicaCount` for probe and the transcodes.
- `infra/k8s/helm-values/`: values for the charts `make k3d-up` installs: `postgres.yaml`, `redis.yaml`, `minio.yaml`, `keda.yaml`, `kube-prometheus-stack.yaml`.
- `infra/k8s/kind-config.yaml`: the cluster config when `CLUSTER_TOOL=kind`.

---

## 2. Invariants & Rules

1. **KEDA Queue Autoscaling:** Each worker Deployment scales on a Prometheus trigger over `bullmq_queue_jobs{queue="<stage>", state=~"waiting|prioritized|active"}` (`base/scaled-objects.yaml`).
   - Scale-to-zero: every ScaledObject has `minReplicaCount: 0`.
   - Scale-in Protection: `terminationGracePeriodSeconds` is sized per stage so an in-flight job can finish: 30 (API, notify), 60 (probe, housekeeping), 120 (thumbnail, package), 300 / 600 / 900 (480p / 720p / 1080p transcode). `apps/worker/src/__tests__/registry.test.ts` reads these manifests to keep each stage's `shutdownTimeoutMs` at the grace period less the 5 s preStop and a 5 s margin.
2. **Resource Boundaries:** Every container MUST specify explicit `resources.requests` and `resources.limits` for CPU and memory. The cloud overlay's `alloy.yaml` is the one container that sets none yet.
3. **Kustomize Discipline:** Never duplicate manifest definitions; place base specs in `base/` and apply transformations in overlays (`kustomization.yaml`).
4. **Validation:** Both overlays must render and pass kubeconform: `make k8s-validate` runs `scripts/validate-k8s.sh`, which falls back to rendering only when kubeconform is neither installed nor runnable in Docker. CI runs no kubeconform; `tests/architecture/production-secrets.test.ts` renders the base and the cloud overlay with `kustomize build`.

---

## 3. Dedicated Skills

- **`vp-keda-queue-autoscaling`**: KEDA trigger definitions and autoscaling mechanics.

---

## 4. Local Commands

```bash
# Create local k3d (or kind with CLUSTER_TOOL=kind) cluster and install the Helm charts
make k3d-up

# Build images, import them and apply the local overlay
make k3d-deploy

# Render both overlays and validate them with kubeconform
make k8s-validate

# Tear down local k3d cluster
make k3d-down
```
