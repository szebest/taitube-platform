# Environment template

`make new-environment NAME=<name>` copies this directory to `infra/environments/<name>`, sets `name`, and
leaves you three files to edit. Run `make deploy-plan ENV=<name>` to see what it would apply.

| File | What it holds |
|---|---|
| `environment.yaml` | The typed values: where it deploys, which images, hosts, flags, scaling and which secrets it expects. |
| `kustomization.yaml` | Structure only: which overlay under `infra/k8s` it inherits. No value belongs here. |
| `README.md` | What the environment is for and what to know before deploying it. |

## environment.yaml

| Field | Meaning |
|---|---|
| `name` | The directory name. Lower case, letters, digits and dashes. |
| `kind` | `k3d` (a local cluster the script creates), `k3s` (a cluster you have) or `compose` (one VM running Docker Compose). |
| `description` | One sentence on what it is for; `make deploy-list` prints it. |
| `production` | The pods run with `NODE_ENV=production`. Every key the schema requires in production must be listed under `secrets.keys` or `config`; `tests/architecture/environments.test.ts` fails otherwise. |
| `protected` | A deploy needs `--yes` (or `--confirm <name>`) and an image tag that is not `latest`. A production-mode environment must be protected. |
| `images.source` | `registry` pulls `<registry>/vp-api:<tag>`; `build` builds this checkout and imports the images into k3d. |
| `images.registry`, `images.tag` | Where from and which version. `{sha}` means `sha-<HEAD>`, the tag `images.yml` pushes for a commit. `TAG=v1.2.3 make deploy ENV=<name>` overrides it. |
| `hosts` | `web`, `studio`, `api`, `cdn`: bare host names. `web` and `studio` become `CORS_ORIGINS`, `cdn` becomes `CDN_BASE_URL`. |
| `features` | `captions` and `screening` set `CAPTIONS_ENABLED` and `SCREENING_ENABLED`. |
| `config` | Non-secret keys written to the `vp-config` ConfigMap. Every name must exist in the env schema and may not also be a secret. |
| `secrets.source` | `env-file`: `.secrets/<name>.env` is the source and the script applies it. `external-secrets`: the cluster's secret store holds the values. |
| `secrets.keys` | The names the environment expects, never values. `make secrets-check ENV=<name>` lists the ones missing from `.secrets/<name>.env`. |
| `health.readyzTimeoutSec` | How long a deploy waits for `/readyz` before it rolls back. |
| `health.smoke` | Run `scripts/e2e-smoke.sh` after `/readyz`. It uploads a clip: leave it off for production. |
| `cluster.context` | The `kubectl` context the deploy must run against. Any other current context is refused. |
| `cluster.namespace` | A fixed name, or `preview-{slug}` with a `preview` block. |
| `cluster.backing` | `helm` installs Postgres, Redis and MinIO in the namespace; `managed` expects them outside (Neon, R2). |
| `scaling.maxReplicas` | Ceilings for the KEDA ScaledObjects by stage. A stage left out keeps the base's. |
| `scaling.budget` | Optional `cpu`, `memory` and `pods`: a ResourceQuota on the namespace. |
| `preview.ttlHours` | For a `{slug}` namespace: hours until `make deploy-expire-previews` may delete it. |
| `compose` | For `kind: compose`: `file`, `project` and the Docker `context` of the VM. |

Secrets are never values in this directory. See [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md#secrets).
