# staging

The rehearsal for production: the cloud overlay on its own cluster (`k3s-staging`), with its own Neon database, deployed from main at `sha-<HEAD>`. NODE_ENV is production, so a boot refuses any secret that
is a local credential.

```bash
make secrets-check ENV=staging
make deploy-plan ENV=staging
make deploy ENV=staging YES=1
```

Secrets reach the pods through External Secrets from the store behind `vp-secret-store`; the names are the
`secrets.keys` of `environment.yaml` and the `ExternalSecret` in `infra/k8s/overlays/cloud`, held equal by
`tests/architecture/environments.test.ts`. The hosts are placeholders on `example.com`: set yours.

The Terraform in `infra/terraform` names the R2 buckets `vp-raw` and `vp-public` and the cloud overlay does not
set `S3_BUCKET_RAW` and `S3_BUCKET_PUBLIC`, so this file does. Staging needs its own Cloudflare account, or
bucket names edited in both places, so it never shares production's buckets.

Inherits `infra/k8s/overlays/cloud`.
