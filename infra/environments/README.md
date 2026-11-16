# Environments

One directory per place the platform runs. Each holds a typed `environment.yaml` and a `kustomization.yaml`
that inherits from [`infra/k8s`](../k8s); a compose environment holds a compose file instead.

| Environment | Kind | For |
|---|---|---|
| [`local`](local/README.md) | k3d | Your machine, images built from this checkout. |
| [`preview`](preview/README.md) | k3s | A namespace per branch or pull request, expiring. |
| [`staging`](staging/README.md) | k3s | The rehearsal for production. |
| [`production`](production/README.md) | k3s | What real users reach. |
| [`compose-vm`](compose-vm/README.md) | compose | One VM running Docker Compose. |

`make deploy ENV=<name>` deploys one; `make new-environment NAME=<name>` adds one from
[`_template`](_template/README.md). The model, the flow and day-2 tasks are in
[docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
