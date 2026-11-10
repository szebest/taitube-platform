# production

What real users reach: the cloud overlay on `k3s-production`. Protected: a deploy needs the right kubectl
context, a pinned release tag (`TAG=v1.2.3`, never `latest`), and the name typed back (`CONFIRM=production`; `YES=1` alone is refused). No smoke
upload runs against it (it mints a dev token, which JWKS auth rejects); the health gate is `/readyz` and a failure rolls the deploy back.

```bash
make secrets-check ENV=production
make deploy-preflight ENV=production TAG=v1.2.3
make deploy-plan ENV=production TAG=v1.2.3
make deploy ENV=production TAG=v1.2.3 CONFIRM=production
make deploy-rollback ENV=production CONFIRM=production
```

The preflight compares the key names of `vp-secrets` in the cluster with `secrets.keys`, so no value needs to sit
in `.secrets/production.env`; `secrets-check` reads that file only if you keep one.

Adding a key a production boot requires to the env schema fails `pnpm test:architecture` until it is listed
in `secrets.keys` or `config` here. The hosts are placeholders on `example.com`: set yours. Size `budget` to
the node (`hcloud_server_type` in `infra/terraform`).

Inherits `infra/k8s/overlays/cloud`. Go-live checklist: [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md#go-live-checklist).
