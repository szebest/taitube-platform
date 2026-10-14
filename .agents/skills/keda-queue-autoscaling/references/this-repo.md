# This repo

Design: `docs/SDD.md` §13.2, ADR-12, §9.4, §12.2. The ScaledObjects are
`infra/k8s/base/scaled-objects.yaml`, the source of truth for every number below.

- **One Deployment per worker stage** (`vp-worker-<stage>`), replicas owned by KEDA,
  `minReplicaCount: 0`, one Prometheus trigger each, `threshold: "1"`,
  `activationThreshold: "0"`, `cooldownPeriod: 300`.
  `packages/server/testing/src/__tests__/k8s-keda-autoscaling.test.ts` holds every
  ScaledObject to that one trigger, its threshold and its query.
- **The metric** is `bullmq_queue_jobs{queue, state}`, exported by the API's queue poller;
  every API replica exports the same depth, hence `max by (state)` before the `sum`.
  `ScaleToZeroBroken` in `infra/observability/alerts/video-pipeline-alerts.yaml` covers a
  stage that never returns to zero.
- **Sizing**: the cloud overlay (`infra/k8s/overlays/cloud/kustomization.yaml`) caps 1080p
  and 720p at one replica and 480p and probe at two; scale to zero is the cost lever there,
  not scale-out. The API is not KEDA-scaled.
- **Grace periods** per stage in `infra/k8s/base/worker-*.yaml`, from 900 s for 1080p down to
  30 s for notify.
- **Without Kubernetes**: `pnpm compose-autoscaler` (`packages/server/compose-autoscaler`)
  polls the same metric and scales Compose services with the same min, max and cooldown.
  Compose stops the newest containers on scale-in, so a busy one can go: the idempotent redo
  covers it.
- **Local cluster**: `make k3d-up && make k3d-deploy`.
