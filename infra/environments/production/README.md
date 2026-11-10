# production

What real users reach: the cloud overlay on `k3s-production`. Protected: a deploy needs the right kubectl
context, a pinned release tag (`TAG=v1.2.3`, never `latest`), and `YES=1` or the name typed back. No smoke
upload runs against it; the health gate is `/readyz` and a failure rolls the deploy back.

```bash
make secrets-check ENV=production
make deploy-preflight ENV=production TAG=v1.2.3
make deploy-plan ENV=production TAG=v1.2.3
make deploy ENV=production TAG=v1.2.3 YES=1
make deploy-rollback ENV=production
```

Adding a key a production boot requires to the env schema fails `pnpm test:architecture` until it is listed
in `secrets.keys` or `config` here. The hosts are placeholders on `example.com`: set yours. Size `budget` to
the node (`hcloud_server_type` in `infra/terraform`).

Inherits `infra/k8s/overlays/cloud`. Go-live checklist: [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md#go-live-checklist).
