# Kubernetes Manifests (`infra/k8s`)

Declarative Kubernetes manifests for deploying the `video-pipeline` platform, organized with Kustomize.

---

## Directory Structure

```
infra/k8s/
├── base/                  # Base manifests (API, workers, services, ingress, KEDA ScaledObjects)
├── helm-values/           # Addon configurations (KEDA, metrics-server)
└── overlays/
    ├── local/             # Local k3d cluster overlay with in-cluster dependencies
    └── cloud/             # Cloud production overlay (Neon, R2, SOPS encrypted secrets)
```

---

## Autoscaling with KEDA

Worker pods dynamically scale from 0 to N based on BullMQ queue metrics exposed by Prometheus:
- **Zero Idle Waste:** Scale to 0 replicas when there are no jobs in queue.
- **Safe Draining:** Pod termination grace periods (`300s`) prevent cutting off active FFmpeg transcode jobs.

---

## Deployment Workflows

### Local k3d Cluster
```bash
make k3d-up        # Provisions k3d cluster with KEDA and Traefik
make k3d-deploy    # Applies local Kustomize overlay
make smoke         # Verifies pipeline through cluster ingress
make k3d-down      # Deletes local cluster
```

### Manifest Validation
```bash
scripts/validate-k8s.sh
```

See [AGENTS.md](AGENTS.md) for agent guidelines.
