# local

A k3d cluster named `vp` on your machine: Postgres, Redis and MinIO from Helm, KEDA and the monitoring stack,
images built from this checkout, dev auth. Nothing leaves the machine.

```bash
make deploy-plan ENV=local
make deploy ENV=local
make deploy-status ENV=local
```

`ADMIN_TOKEN` lives in the git-ignored `.secrets/local.env`; the deploy writes it once with a random value.
The same cluster is what `make k3d-up && make k3d-deploy` builds. The web app is on `http://localhost:3000`
and the studio on `http://studio.localhost:3000`.

Inherits `infra/k8s/overlays/local` (the base plus the `dev-mode` component).
