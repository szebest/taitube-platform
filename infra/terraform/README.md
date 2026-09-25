# Terraform Cloud Infrastructure (`infra/terraform`)

Infrastructure-as-Code for the `video-pipeline` cloud reference deployment, on the Cloudflare v5 provider and Hetzner Cloud.

---

## Provisioned Resources

- **Cloudflare R2 Buckets:**
  - `vp-raw`: private storage for incoming uploads, with a lifecycle rule that aborts incomplete multipart uploads after a day and expires objects after `raw_retention_days`.
  - `vp-public`: HLS playlists, segments and thumbnails, served through the `cdn.<domain>` custom domain.
- **Scoped R2 API tokens:** the API's reads and writes `vp-raw` only; the worker's reads and writes both buckets.
- **Cloudflare Tunnel:** routes `api.<domain>` to the k3s node without an open inbound port.
- **Cloudflare Access:** in front of `api.<domain>/admin`, allowing `admin_email` only.
- **Hetzner Cloud:** the k3s node and a firewall that opens SSH to `operator_ssh_ip` only.

---

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

CI runs `terraform fmt -check -recursive` and `terraform validate` on every change; the specs that read the HCL run with:
```bash
pnpm --filter @vp/testing test cloud-terraform cloud-r2-tokens
```

See [AGENTS.md](AGENTS.md) for agent guidelines.
