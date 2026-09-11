# Cloud Overlay & Encrypted Secrets (`infra/k8s/overlays/cloud`)

This directory contains the Kubernetes Kustomize overlay for the **video-pipeline** cloud reference deployment (SDD §12.3 Rung 3, Ticket 31 & Ticket 32).

## Encrypted Secrets (`secrets.enc.yaml`)

Sensitive values (database credentials, API tokens, tunnel secrets, observability headers) are committed to git encrypted using [Mozilla SOPS](https://github.com/getsops/sops) and [age](https://github.com/FiloSottile/age).

### Prerequisites

Install `sops` and `age`:
- **macOS**: `brew install sops age`
- **Linux**: `apt install age` or download release from GitHub; install `sops` from GitHub releases.
- **Windows**: `scoop install sops age` or `choco install sops age.portable`

### How to Decrypt and View Secrets

To view decrypted secrets in your terminal:
```bash
# Using an age private key file
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
# OR export private key directly
export SOPS_AGE_KEY="AGE-SECRET-KEY-1..."

sops -d secrets.enc.yaml
```

### How to Edit Secrets In-Place

To edit secrets (SOPS will decrypt for editing and re-encrypt upon saving):
```bash
sops secrets.enc.yaml
```

### How to Apply to a Kubernetes Cluster

In CI/CD or deployment runbooks:
```bash
export SOPS_AGE_KEY=$(cat ~/.config/sops/age/keys.txt)
sops -d secrets.enc.yaml | kubectl apply -f -
```

### Encrypted Keys Reference (SDD §16.8)

Every value with a 🔒 marker in `.env.example` is represented in `secrets.enc.yaml`:
- `DATABASE_URL` / `DATABASE_URL_MIGRATIONS` (Neon PostgreSQL)
- `REDIS_URL` / `REDIS_PUBSUB_URL` / `REDIS_PASSWORD` (Redis)
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (Cloudflare R2)
- `ADMIN_TOKEN` / `WEBHOOK_SIGNING_SECRET` (Auth & Webhooks)
- `OTEL_EXPORTER_OTLP_HEADERS` / `PROMETHEUS_REMOTE_WRITE_URL` / `LOKI_URL` (Grafana Cloud)
- `CLOUDFLARE_TUNNEL_TOKEN` / `CLOUDFLARE_API_TOKEN` / `HCLOUD_TOKEN` / `GHCR_TOKEN` (Cloud infrastructure)
