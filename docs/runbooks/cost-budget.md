# Runbook: Cloudflare R2 Class A Operations Budget

## 1. Overview & Architecture
Cloudflare R2 provides an S3-compatible object storage tier with 1,000,000 Class A operations (PUT, POST, multipart create/complete, list) included per month in the free tier (SDD §12.3, PRD §11).

In `video-pipeline`, every segment and thumbnail uploaded represents a Class A PUT operation. A 10-minute video produces ~300 segments across 3 renditions, consuming ~300 Class A ops.

The `R2ClassABudget` alert uses `predict_linear` over a 24-hour observation window to project monthly Class A operation count. If the projected monthly volume exceeds 900,000 (90% of the 1M free budget), the alert fires at `info` severity to give operators ample lead time.

---

## 2. Trigger Alert
- **Alert Name**: `R2ClassABudget`
- **Expression**: `predict_linear(storage_ops_total{op="put"}[1d], 30*86400) > 900000`
- **Severity**: `info`
- **Duration**: `1h`

---

## 3. Dashboards to Open
- **Storage & Cost Dashboard**: `/d/storage-cost` — Check "Projected Monthly Class A Ops (R2 1M/mo Free Tier Budget)" gauge and "Class A & Class B Storage Ops per Hour" time series.

---

## 4. Diagnosis & Remediation Steps

### Step 1: Check Current Rate of Uploads
Query Prometheus for current rate of PUT operations:
```promql
sum(rate(storage_ops_total{op="put"}[1h])) * 3600
```
Determine which stage or bucket is driving operations:
```promql
sum by (bucket, op) (rate(storage_ops_total[1h])) * 3600
```

### Step 2: Check for Segment Runaway or Retries
Excessive PUT ops can be caused by:
- Excessive transcode retries (e.g. storage latency causing repeated re-uploads). Check `jobs_processed_total{result="failed"}`.
- Unusually short segment duration (ensure standard 6-second segments: `FFMPEG_SEGMENT_SECONDS=6`).
- Upload storms / abuse by a single user. Check `POST /v1/uploads` request rates in API logs.

### Step 3: Mitigation Options
1. **Enable Admission Control**: Clamp concurrent in-flight uploads per user or reduce rate limits.
2. **Increase Segment Duration**: Increasing segment duration from 6s to 10s decreases segment count (and PUT ops) by 40%.
3. **Provider Fallback Ladder (SDD §12.3)**: If workload legitimately exceeds free tier, switch to Backblaze B2 via Cloudflare Bandwidth Alliance, or add payment details to R2 ($4.50 per million ops beyond 1M).

---

## 5. Verification
1. Inspect the Storage & Cost dashboard gauge `Projected Monthly Class A Ops`.
2. Confirm the projection drops below 900,000 operations.
3. Verify alert `R2ClassABudget` resolves.

---

## 6. Cost Statement (≤ €6.5/mo Reference Deployment)
As per SDD §12.3 Phase 4 Cloud Reference Deployment, the target monthly running cost is ≤ €6.50.

### Bill Breakdown:
- **Compute (VPS)**: Hetzner CAX11 (2 vCPU Arm64, 4GB RAM) = €5.99/mo (or Oracle Cloud A1 Always Free = €0/mo)
- **Networking**: Included IPv4 = €0.50/mo (if applicable)
- **Domain**: Amortized ~€0.80/mo (annual fee varies by TLD)
- **Total fixed cost**: ~€6.49/mo (ex-VAT)

### Free Tier Usage Snapshot (Zero Cost Additions):
- **Object Storage**: Cloudflare R2 (10 GB storage, 1M Class A ops, 10M Class B ops, $0 egress).
- **Database**: Neon Serverless Postgres (0.5 GB storage, 100 CU-h/mo, 5 min autosuspend).
- **Observability**: Grafana Cloud Free (10k active series, 50 GB logs, 50 GB traces, 14-day retention).
- **CDN / Tunnel**: Cloudflare Free tier (Zero Trust Access, Cloudflare Tunnel).

---

## 7. Provider Fallback Ladder

If usage outgrows the free tiers or availability guarantees of the primary serverless providers, apply these exact environment variable changes to migrate to the next rung (SDD §12.3).

### Storage: R2 → Backblaze B2
When R2 free tier is exceeded or Backblaze is cheaper for the workload (e.g. storage size vs ops):
1. **Provision**: Create a Backblaze B2 bucket and App Keys.
2. **Env changes** in `infra/k8s/overlays/cloud/kustomization.yaml` (via ConfigMap patches) and `secrets.enc.yaml`:
   - `S3_ENDPOINT`: `https://s3.<region>.backblazeb2.com`
   - `S3_ACCESS_KEY_ID`: `<B2_KEY_ID>`
   - `S3_SECRET_ACCESS_KEY`: `<B2_APPLICATION_KEY>`
   - `S3_REGION`: `<region>`
   - `CDN_BASE_URL`: Proxy via Cloudflare Worker or B2 native CDN integration.

### Database: Neon → Self-Hosted VPS Postgres
When 100 CU-h/mo is exceeded or autosuspend latency is unacceptable:
1. **Provision**: Run Postgres via Helm on the k3s cluster or on a secondary VPS.
2. **Env changes** in `secrets.enc.yaml`:
   - `DATABASE_URL`: `postgres://vp:<password>@vp-postgres:5432/vp` (internal DNS)
   - `DATABASE_URL_MIGRATIONS`: `postgres://vp:<password>@vp-postgres:5432/vp`
3. **Env changes** in `kustomization.yaml`:
   - `DATABASE_POOL_MAX`: Can be increased to `20` or higher since it's no longer constrained by Neon connection limits.
   - `HOUSEKEEPING_INTERVAL_MS`: Can be reduced to `60000` (1 minute) as autosuspend is no longer a factor.
