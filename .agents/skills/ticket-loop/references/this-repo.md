# This repo

- **The board**: ready tickets are listed under `docs/tickets/README.md#frontier`; confirm
  each against its file's `**Status:**` line and `Blocked by` row. Statuses and the index:
  `work-ticket`, `references/this-repo.md`.
- **Files leads collide on**: migrations in `packages/server/db`,
  `apps/server/api/src/composition/services.module.ts`,
  `packages/universal/api-contracts/openapi.yaml`, `docs/tickets/README.md`,
  `pnpm-lock.yaml`, `packages/server/env-schema`, `apps/client/web/src/components/ui/`.
- **Regenerated, never hand-merged**: `pnpm-lock.yaml` (`pnpm install`), `openapi.yaml`
  (`pnpm gen:contracts`), `docs/tickets/README.md` (`python3 docs/tickets/gen-index.py`).
- **Domain skills for an implementer**: `hexagonal-port-adapter`, `bullmq-pipeline`,
  `postgres-cas-fencing`, `hls-ladder`, `keda-queue-autoscaling`, `chaos-toxiproxy`,
  `local-first-check`, and in `apps/server/api` `fastify-sse-problem-json`.
- **The merge command** handed to the owner, per PR:

```
gh pr merge <N> --repo szebest/taitube-platform --squash --subject "NN: <ticket title> (#<N>)" --delete-branch
```
