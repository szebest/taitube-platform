# Runbook: Cloud Accounts & Prerequisites Setup (Phase 4)

This runbook guides operators through setting up the external cloud services required for the **video-pipeline** reference deployment (SDD §15.3, §12.3, §17, ADR-06, ADR-15).

> **Reminder (Local-First Guarantee):** None of these accounts or credentials are required for local development, automated testing, or Docker Compose execution. Follow this guide only when preparing for Ticket 31 & Ticket 32 cloud deployment.

---

## Service Accounts Overview & Mapping

| Service | Category | Free Tier Facts (Verified 2026-09) | What to Click / Console Path | Target Environment Variable / Secret |
|---|---|---|---|---|
| **Cloudflare** | DNS, CDN, R2, Tunnel, Access | 10 GB R2, 1M Class A ops, 10M Class B ops, $0 egress; Zero Trust <= 50 seats free | Dash -> R2 / Zero Trust / API Tokens | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_TUNNEL_TOKEN`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| **Hetzner Cloud** | Compute VPS (k3s) | CAX11 €5.99/mo (Arm) or CX23 €5.49/mo (x86) + €0.50 IPv4 (ex-VAT) | Console -> Security -> API Tokens & SSH Keys | `HCLOUD_TOKEN`, SSH Key in `~/.ssh/id_ed25519` |
| **Oracle Cloud** | Alternative Compute | Always Free: 2 OCPU / 12 GB RAM A1 Arm (post-June 2026 adjustment), 200 GB block | Console -> Compute -> Instances | `ORACLE_SSH_KEY` / alternative VPS |
| **Neon** | Serverless Postgres | 0.5 GB storage, 100 CU-h/mo, 5 min autosuspend | Console -> Project -> Connection Details | `DATABASE_URL` (pooler), `DATABASE_URL_MIGRATIONS` (direct) |
| **Grafana Cloud** | Observability (OTel/Logs/Metrics) | 10k metric series, 50 GB logs, 50 GB traces, 14-day retention | Grafana Portal -> OpenTelemetry / Prometheus / Loki | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `LOKI_URL` |
| **GitHub** | Registry & CI | Actions free for public repos, GHCR free for public packages | Settings -> Developer Settings -> PAT | `GHCR_USERNAME`, `GHCR_TOKEN` (optional for private images) |

---

## 1. Cloudflare Setup

### Prerequisites
A registered domain (e.g. `example.com`) added to Cloudflare with active DNS management.
*(Note: A custom domain is required for R2 CDN hostname support; otherwise, presigned GET playback must be used).*

### Step 1.1: Account ID & Terraform API Token
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Select your domain/account. In the right-hand sidebar or browser URL, find **Account ID** (32 hex characters).
   - Feeds: `CLOUDFLARE_ACCOUNT_ID`
3. Navigate to **My Profile** -> **API Tokens** -> **Create Token**.
4. Choose **Create Custom Token**:
   - Token name: `vp-terraform-provisioner`
   - Permissions:
     - `Account` | `Worker R2 Storage` | `Edit`
     - `Account` | `Cloudflare Tunnel` | `Edit`
     - `Account` | `Access: Apps and Policies` | `Edit`
     - `Zone` | `DNS` | `Edit`
     - `Zone` | `Zone Settings` | `Read`
     - `Zone` | `Zone` | `Read`
   - Account Resources: Include your target account.
   - Zone Resources: Include all zones (or select your specific domain).
5. Click **Continue to summary** -> **Create Token**.
6. Copy the displayed token.
   - Feeds: `CLOUDFLARE_API_TOKEN`

### Step 1.2: R2 Storage API Token Pair (API vs Worker Scopes)
Terraform manages the buckets (`vp-raw` and `vp-public`), but S3 clients require R2 API tokens with S3 Access Key IDs and Secret Access Keys:
1. Navigate to **R2** -> **Manage R2 API Tokens** -> **Create API token**.
2. **API App Token** (Used by `apps/api` for presigning and verification):
   - Token name: `vp-api-r2`
   - Permissions: `Object Read & Write`
   - Specify bucket: `vp-raw`
   - Click **Create API Token**.
   - Note down:
     - Access Key ID
     - Secret Access Key
     - S3 Endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
   - Feeds: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` in API configuration.
3. **Worker App Token** (Used by `apps/worker` across pipeline stages):
   - Token name: `vp-worker-r2`
   - Permissions: `Object Read & Write`
   - Specify buckets: `vp-raw` (read source) and `vp-public` (write segments & playlists).
   - Feeds: Worker storage secrets.

### Step 1.3: Cloudflare Zero Trust (Tunnel & Access)
1. Go to **Zero Trust** in the Cloudflare dashboard.
2. If first time: choose an organization name and select the Free plan (up to 50 users).
3. The tunnel and Access policy are managed via Terraform (`infra/terraform`), which generates the tunnel credentials and outputs `CLOUDFLARE_TUNNEL_TOKEN`.

---

## 2. Hetzner Cloud Setup (Primary VPS)

### Step 2.1: Project & API Token
1. Log in to [console.hetzner.cloud](https://console.hetzner.cloud/).
2. Click **New Project** -> Name: `video-pipeline`.
3. Inside the project, go to **Security** -> **API Tokens** -> **Generate API Token**.
   - Name: `vp-terraform`
   - Permissions: `Read & Write`
4. Copy the generated token immediately.
   - Feeds: `HCLOUD_TOKEN`

### Step 2.2: SSH Key Pair
1. Check your local SSH key: `cat ~/.ssh/id_ed25519.pub`. If none exists, generate one:
   ```bash
   ssh-keygen -t ed25519 -C "operator@video-pipeline"
   ```
2. In Hetzner Console: **Security** -> **SSH Keys** -> **Add SSH Key**.
   - Paste the public key content.
   - Name: `vp-admin-key`
   - Note the name or let Terraform reference your public key string directly.

---

## 3. Oracle Cloud Infrastructure (OCI) Setup (Zero-Cost Alternative)

If using the Always Free Arm path instead of Hetzner (ADR-15, SDD §12.3):

1. Log in to [cloud.oracle.com](https://cloud.oracle.com/).
2. Navigate to **Compute** -> **Instances** -> **Create Instance**.
3. Configure instance:
   - Image: Ubuntu 24.04 LTS (aarch64).
   - Shape: Ampere `VM.Standard.A1.Flex` with **2 OCPU** and **12 GB RAM** (complies with post June 15, 2026 limits).
   - Networking: Assign public IPv4 address.
   - SSH Keys: Upload your `id_ed25519.pub`.
   - Boot volume: Default 50 GB (up to 200 GB Always Free).
4. Note: If "Out of capacity for shape VM.Standard.A1.Flex" occurs, retry in other Availability Domains or proceed with Hetzner CAX11 (€5.99/mo).

---

## 4. Neon Setup (Serverless PostgreSQL)

1. Log in to [neon.tech](https://neon.tech/).
2. Click **Create Project**:
   - Name: `video-pipeline`
   - Postgres version: `16` or `17`
   - Region: Select region closest to your VPS (e.g. `Frankfurt (eu-central-1)` for Hetzner Falkenstein/Nuremberg).
   - Compute size: 0.25 CU (autoscaling disabled or max 1 CU).
3. Under **Dashboard** -> **Connection Details**:
   - Ensure the database `vp` is created (or create it in the SQL Editor: `CREATE DATABASE vp;`).
4. Copy the connection strings:
   - **Pooled connection** (Connection pooling toggle ON):
     ```
     postgresql://user:password@ep-xyz-pooler.eu-central-1.aws.neon.tech/vp?sslmode=require
     ```
     - Feeds: `DATABASE_URL` (used by Fastify API and BullMQ worker runtime).
   - **Direct connection** (Connection pooling toggle OFF):
     ```
     postgresql://user:password@ep-xyz.eu-central-1.aws.neon.tech/vp?sslmode=require
     ```
     - Feeds: `DATABASE_URL_MIGRATIONS` (used by Drizzle migration runner job).

---

## 5. Grafana Cloud Setup (Observability)

1. Log in to [grafana.com](https://grafana.com/) and navigate to your cloud portal.
2. Under **OpenTelemetry**:
   - Click **Configure** / **Send Data**.
   - Note the OTLP Endpoint URL: `https://otlp-gateway-<region>.grafana.net/otlp`
   - Generate an API Token / Access Policy with `metrics:write`, `logs:write`, `traces:write`.
   - Copy the Authorization Header (Basic `<base64>`):
     - Feeds: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`
3. Under **Loki** & **Prometheus**:
   - Note the Push endpoint URLs for Grafana Alloy daemonset.
   - Feeds: `LOKI_URL`, `PROMETHEUS_REMOTE_WRITE_URL`

---

## 6. Secrets Encryption with SOPS & age

To protect sensitive credentials in git according to the project's non-negotiable rules:

1. **Install `age` and `sops`**:
   - macOS: `brew install age sops`
   - Linux: `sudo apt install age` or download binaries from GitHub releases.
   - Windows: `scoop install age sops` or `choco install age.portable sops`
2. **Generate an age key pair**:
   ```bash
   age-keygen -o age.key
   ```
   - Public key looks like: `age1...`
   - Store `age.key` safely (e.g. `~/.config/sops/age/keys.txt` or export `SOPS_AGE_KEY`).
3. **Configure SOPS**:
   The repo includes `.sops.yaml` matching your age public key.
4. **Edit encrypted secrets**:
   ```bash
   sops infra/k8s/overlays/cloud/secrets.enc.yaml
   ```
5. **Decrypting in CI or deployment**:
   ```bash
   export SOPS_AGE_KEY=$(cat age.key)
   sops -d infra/k8s/overlays/cloud/secrets.enc.yaml | kubectl apply -f -
   ```

---

## 7. Execution Checklist & Verification Log

Print or copy this checklist when provisioning:

- [ ] Cloudflare Account ID noted
- [ ] Cloudflare API Token generated with DNS, Tunnel, R2, and Access permissions
- [ ] Cloudflare R2 API token created with S3 credentials
- [ ] Hetzner API Token generated and SSH key uploaded
- [ ] Neon project created; pooled and direct URLs saved
- [ ] Grafana Cloud OTLP credentials generated
- [ ] `infra/terraform/terraform.tfvars` filled from `.example`
- [ ] `terraform plan` executed with 0 errors
- [ ] `terraform apply` completed; outputs saved
- [ ] Cloud secrets recorded in `infra/k8s/overlays/cloud/secrets.enc.yaml`
- [ ] R2 live compatibility test executed: `STORAGE_E2E_R2=1 pnpm test`
