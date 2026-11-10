# AGENTS.md — @vp/deploy (server tier)

Instructions for any coding agent working on `packages/server/deploy`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope

The typed half of `scripts/deploy.sh` (`make deploy ENV=<env>`). `pnpm envctl <command>` reads the
environment files under `infra/environments/<env>/environment.yaml`, validates them, and answers the
questions the bash script asks, so the script keeps the `kubectl`, `helm` and `docker` calls and none of
the logic that needs a test.

- `src/environment-spec.ts` is the zod spec of an environment file: a tagged union on `kind` (`k3d`, `k3s`,
  `compose`), the image tag, hosts, feature flags, config keys, the secrets expected by name, replica caps
  and the resource budget, and the preview block that makes a namespace per branch.
- `src/parse-environment.ts` and `src/load-environments.ts` read the files; an underscore directory
  (`_template`) is never an environment.
- `src/required-keys.ts` reads the env schema registry (`ENV_DOCS`, `EXTRA_ENV_DOCS`): a production-mode
  environment must list every key whose `requiredIn` says a production boot needs it, and every key it names
  must exist in the registry. `tests/architecture/environments.test.ts` runs this over the real files.
- `src/secrets-check.ts` compares the names in a git-ignored `.secrets/<env>.env` with what the environment
  expects. It reads values only to say a value is empty or a credential the repo ships for local use, and
  never prints one.
- `src/render-overlay.ts` writes `.deploy/<env>/kustomization.yaml` (and `quota.yaml`): the environment's own
  kustomization plus its images, replica caps, config and, for a preview, the namespace and its expiry.
- `src/migrations.ts`, `src/guards.ts`, `src/preview.ts`, `src/image-tag.ts` are the pure rules: migrations
  only added, the context and confirmation a protected environment needs, the preview slug and expiry, the
  `{sha}` tag.
- `src/cli.ts` parses arguments over a `DeployHost`; `src/main.ts` wires the file system, git and the
  process. Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.

- **Tier `server`**, **layer 4**: it reads `@vp/env-schema` (3), `@vp/job-contracts` (2) and `@vp/result` (1).

---

## 2. Invariants

1. **The environment file is the one place its values live.** A replica cap, host, flag or secret name is
   written in `environment.yaml` and nowhere else; the kustomization beside it holds structure only.
2. **Names only.** No code path prints a secret's value, a value's length or a hash of it.
3. **No network.** Nothing here calls a registry, a cluster or a cloud API; `scripts/deploy.sh` does, and
   only in a real run.
4. **1:1 tests (Rule 12):** every source file has a name-matching test file in `src/__tests__/`.

---

## 3. Local Commands

```bash
pnpm envctl list
pnpm envctl validate
pnpm envctl render preview --slug feat/x
pnpm --filter @vp/deploy test
```
