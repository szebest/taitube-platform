# Cloud Overlay & Secrets (`infra/k8s/overlays/cloud`)

This directory contains the Kubernetes Kustomize overlay for the **video-pipeline** cloud reference deployment (SDD §12.3 Rung 3, Ticket 31 & Ticket 32).

## Secrets (`external-secret.yaml`)

The repo holds no credential for the cloud deployment, encrypted or not. `external-secret.yaml` declares an
[External Secrets Operator](https://external-secrets.io) `ExternalSecret` that materialises the `vp-secrets`
Secret from a `ClusterSecretStore` named `vp-secret-store`, and the overlay deletes the base's local
`vp-secrets` Secret, so a rendered cloud manifest carries no secret value at all.
`tests/architecture/production-secrets.test.ts` renders this overlay and holds both properties.

### Prerequisites

- External Secrets Operator installed in the cluster.
- A `ClusterSecretStore` named `vp-secret-store` pointing at your secret manager.

### Keys the store must hold (under `video-pipeline/<KEY>`)

- `DATABASE_URL` / `DATABASE_URL_MIGRATIONS` (Neon PostgreSQL)
- `REDIS_PASSWORD` (Redis)
- `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (Cloudflare R2)
- `GRAFANA_OTLP_ENDPOINT` / `GRAFANA_OTLP_HEADERS` (Grafana Cloud, read by Alloy only)
- `CLOUDFLARE_TUNNEL_TOKEN` (cloudflared)

There is no `ADMIN_TOKEN` in the cloud: production refuses one, and an admin is a token whose verified role
claim says so. Set `AUTH_JWKS_URL`, `AUTH_ISSUER` and `AUTH_AUDIENCE` in `kustomization.yaml` to your IdP.
