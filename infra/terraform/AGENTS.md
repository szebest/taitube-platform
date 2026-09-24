# AGENTS.md — infra/terraform (Cloudflare & Cloud IAC)

Instructions for any coding agent working on Terraform infrastructure-as-code (`infra/terraform`).

---

## 1. Scope & Resources

`infra/terraform` provisions the cloud reference architecture on Cloudflare and Hetzner (providers pinned in `terraform.tf`, local state by default):
- `cloudflare_r2_bucket.raw` (`vp-raw`): private bucket for uploads; `cloudflare_r2_bucket_lifecycle.raw` aborts incomplete multipart uploads after 1 day and expires objects after `raw_retention_days` (7).
- `cloudflare_r2_bucket.public` (`vp-public`): HLS playlists, segments and thumbnails, served through `cloudflare_r2_custom_domain.public_cdn` at `cdn.<domain>`.
- `cloudflare_tunnel.k3s_tunnel`, `cloudflare_tunnel_config.k3s_tunnel_config` and `cloudflare_record.api_tunnel`: the Cloudflare Tunnel that routes `api.<domain>` to the cluster without a public ingress.
- `cloudflare_access_application.admin_portal` and `cloudflare_access_policy.admin_allow_operator`: Cloudflare Access in front of `api.<domain>/admin`.
- `cloudflare_api_token.r2_api_app` and `cloudflare_api_token.r2_worker_app`: scoped R2 credentials for the API and the workers.
- `hcloud_server.k3s_node`, `hcloud_firewall.vps_firewall` and `hcloud_ssh_key.operator_key`: the Hetzner k3s node, with SSH open only to `operator_ssh_ip`.

No CORS rule is declared on either bucket.

---

## 2. Invariants & Rules

1. **Parity with Local MinIO:** The two R2 buckets must keep the shape `infra/compose/minio-init.sh` gives MinIO: raw private with the same 7-day expiry, public readable. Bucket names differ (`vp-raw`/`vp-public` against `raw`/`public`) and reach the code only through `S3_BUCKET_RAW` / `S3_BUCKET_PUBLIC`; object keys belong to `packages/server/storage/src/keys.ts`.
2. **Deterministic Inputs:** Variables are declared in `variables.tf`; the non-secret ones have defaults. Values go in a `terraform.tfvars` copied from `terraform.tfvars.example`; `cloudflare_api_token` and `hcloud_token` are `sensitive`. No `.gitignore` covers `terraform.tfvars` or the local `*.tfstate`, so never stage either.
3. **Automated Verification:** Nothing runs `terraform validate`, `terraform fmt` or a plan in CI. The only check is `packages/server/testing/src/__tests__/cloud-terraform.test.ts`, which reads the `.tf` files as text and asserts the providers, variables and resource names above; keep it in step with any rename.

---

## 3. Dedicated Skills

- **`cloudflare-r2`**: R2 bucket management, CORS, and Cloudflare Terraform provider.
- **`terraform-style-guide`**: HashiCorp style conventions and HCL patterns.
- **`hetzner-cloud`**: the `hcloud` side of the node.

---

## 4. Commands

```bash
# Initialize Terraform
cd infra/terraform && terraform init

# Check formatting and configuration locally (no CI job does)
cd infra/terraform && terraform fmt -check && terraform validate

# Plan changes
cd infra/terraform && terraform plan

# Run the text-level Terraform test
pnpm --filter @vp/testing test cloud-terraform
```
