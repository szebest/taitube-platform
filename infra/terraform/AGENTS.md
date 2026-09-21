# AGENTS.md — infra/terraform (Cloudflare & Cloud IAC)

Instructions for any coding agent working on Terraform infrastructure-as-code (`infra/terraform`).

---

## 1. Scope & Resources

`infra/terraform` provisions the cloud reference architecture on Cloudflare:
- `cloudflare_r2_bucket.raw`: Private S3-compatible bucket for video uploads.
- `cloudflare_r2_bucket.public`: Public bucket for transcoded HLS playlists and media segments.
- `cloudflare_r2_bucket_cors`: Configured CORS policies for direct-to-storage multipart uploads from web browsers.
- `cloudflare_record`: DNS records mapping custom streaming domains to public buckets and API endpoints.
- `cloudflare_api_token`: Scoped credentials for API and worker S3 clients.
- `cloudflare_zero_trust_tunnel_cloudflared`: Cloudflare Tunnel for routing ingress without public IP exposure.

---

## 2. Invariants & Rules

1. **Parity with Local MinIO:** Cloudflare R2 bucket configurations (naming, CORS, public policies) must strictly match local MinIO conventions defined in `packages/server/storage/src/keys.ts` and `infra/compose/minio-init.sh`.
2. **Deterministic Inputs:** Variables are declared in `variables.tf` with defaults; sensitive variables are passed via `.env` or CI secrets.
3. **Automated Verification:** Any changes to Terraform definitions must pass the syntax and structure tests in `packages/server/testing/src/__tests__/cloud-terraform.test.ts`.

---

## 3. Dedicated Skills

- **`cloudflare-r2`**: R2 bucket management, CORS, and Cloudflare Terraform provider.
- **`terraform-style-guide`**: HashiCorp style conventions and HCL patterns.

---

## 4. Commands

```bash
# Initialize Terraform
cd infra/terraform && terraform init

# Plan changes
cd infra/terraform && terraform plan

# Run automated tests
pnpm --filter @vp/testing test:terraform
```
