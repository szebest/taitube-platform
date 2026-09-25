# AGENTS.md — infra/terraform (Cloudflare & Cloud IAC)

Instructions for any coding agent working on Terraform infrastructure-as-code (`infra/terraform`).

---

## 1. Scope & Resources

`infra/terraform` provisions the cloud reference architecture on Cloudflare and Hetzner, with local state. `terraform.tf` pins the Cloudflare v5 provider by minor version (`~> 5.25.0`) and `.terraform.lock.hcl`, committed with hashes for Linux and macOS on amd64 and arm64, fixes every provider's exact version:
- `cloudflare_r2_bucket.raw` (`vp-raw`): private bucket for uploads; `cloudflare_r2_bucket_lifecycle.raw` aborts incomplete multipart uploads after 1 day and expires objects after `raw_retention_days` (7).
- `cloudflare_r2_bucket.public` (`vp-public`): HLS playlists, segments and thumbnails, served through `cloudflare_r2_custom_domain.public_cdn` at `cdn.<domain>`.
- `cloudflare_zero_trust_tunnel_cloudflared.k3s_tunnel`, `cloudflare_zero_trust_tunnel_cloudflared_config.k3s_tunnel` and `cloudflare_dns_record.api_tunnel`: the Cloudflare Tunnel that routes `api.<domain>` to the cluster without a public ingress. The `cloudflare_tunnel_token` output reads the connector token through the `cloudflare_zero_trust_tunnel_cloudflared_token` data source.
- `cloudflare_zero_trust_access_application.admin_portal` and `cloudflare_zero_trust_access_policy.admin_allow_operator`: Cloudflare Access in front of `api.<domain>/admin`. In v5 the policy is an account-level resource the application attaches through its `policies` list.
- `cloudflare_api_token.r2_api_app` and `cloudflare_api_token.r2_worker_app`: scoped R2 credentials for the API and the workers. v5 takes permission groups by ID, so `main.tf` looks them up by name in the `cloudflare_api_token_permission_groups_list` data source, scoped to R2 buckets.
- `hcloud_server.k3s_node`, `hcloud_firewall.vps_firewall` and `hcloud_ssh_key.operator_key`: the Hetzner k3s node, with SSH open only to `operator_ssh_ip`.

No CORS rule is declared on either bucket.

---

## 2. Invariants & Rules

1. **Parity with Local MinIO:** The two R2 buckets must keep the shape `infra/compose/minio-init.sh` gives MinIO: raw private with the same 7-day expiry, public readable. Bucket names differ (`vp-raw`/`vp-public` against `raw`/`public`) and reach the code only through `S3_BUCKET_RAW` / `S3_BUCKET_PUBLIC`; object keys belong to `packages/server/storage/src/keys.ts`.
2. **Deterministic Inputs:** Variables are declared in `variables.tf`; the non-secret ones have defaults. Values go in a `terraform.tfvars` copied from `terraform.tfvars.example`; `cloudflare_api_token` and `hcloud_token` are `sensitive`. `.gitignore` covers `terraform.tfvars`, `*.tfstate` and `.terraform/`.
3. **Automated Verification:** the `terraform` job in `.github/workflows/ci.yml` runs `terraform fmt -check -recursive`, then `terraform init -backend=false -lockfile=readonly` and `terraform validate`, with the provider plugins cached by the hash of `.terraform.lock.hcl`; `ci-shape.test.ts` holds the job and its 2-minute budget. No credentials reach CI, so nothing plans or applies. `packages/server/testing/src/__tests__/cloud-terraform.test.ts` reads the `.tf` files through `@cdktf/hcl2json` for the pinned provider, the variables, the resource addresses and the attributes the cloud rung depends on, and `cloud-r2-tokens.test.ts` does the same for each R2 token's buckets and permission groups; keep both in step with any rename.
4. **Upgrading a provider:** change the constraint in `terraform.tf`, then refresh the lock for every platform: `terraform providers lock -platform=linux_amd64 -platform=linux_arm64 -platform=darwin_amd64 -platform=darwin_arm64`. CI's `-lockfile=readonly` fails on a lock that no longer matches the constraints.

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

# What the CI terraform job runs
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra/terraform validate

# Plan changes
cd infra/terraform && terraform plan

# Run the specs that read the HCL
pnpm --filter @vp/testing test cloud-terraform cloud-r2-tokens
```
