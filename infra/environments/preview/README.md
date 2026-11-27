# preview

One namespace per branch or pull request, `preview-<slug>`, on the staging cluster. A small ResourceQuota, one
replica per stage at most, captions and screening off, Postgres, Redis and MinIO from Helm in the namespace
with no persistent volume. The namespace carries a `vp.dev/expires-at` annotation set from `preview.ttlHours`.

```bash
make deploy-plan ENV=preview SLUG=feat/new-player
make deploy ENV=preview SLUG=feat/new-player
make deploy-expire-previews            # lists the expired ones, deletes nothing
make deploy-expire-previews APPLY=1    # deletes them
```

A preview runs dev auth with the repo's local credentials, so it has no Ingress (its kustomization deletes the
base one, which `tests/architecture/environments.test.ts` holds): it is never given a host and two previews
cannot collide on a shared cluster. The health gate and you reach it by port-forward:
`kubectl --context k3s-staging -n preview-<slug> port-forward svc/vp-web 5173:5173`. The images come from the registry at
`sha-<HEAD>`: push them first (`images.yml`, manual run with `push`).

Inherits `infra/k8s/base` plus the `dev-mode` component, minus the Ingress. The smoke upload runs here because dev auth lets it mint a token.
