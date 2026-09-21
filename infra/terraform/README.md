# Terraform Cloud Infrastructure (`infra/terraform`)

Infrastructure-as-Code for provisioning Cloudflare reference cloud services for `video-pipeline`.

---

## Provisioned Resources

- **Cloudflare R2 Buckets:**
  - `raw`: Secure private storage for incoming video uploads.
  - `public`: High-throughput public storage with custom domain routing for HLS video playback.
- **CORS Configuration:** Browser PUT/GET access policies matching local MinIO setup.
- **Cloudflare DNS & Custom Domains:** CNAME routing for custom streaming CDNs.
- **Cloudflare Tunnel:** Zero-trust reverse proxy routing incoming traffic without open inbound firewall ports.

---

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

To run automated HCL and resource validation tests:
```bash
pnpm --filter @vp/testing test:terraform
```

See [AGENTS.md](AGENTS.md) for agent guidelines.
