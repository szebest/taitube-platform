# This repo

| Source | Here |
| --- | --- |
| Tickets | `docs/tickets/<NN>-<slug>.md`, with the board and dependency graph in `docs/tickets/README.md`; each ticket is mirrored to a GitHub issue on merge (`.github/workflows/sync-tickets.yml`) |
| Requirements and design | `docs/PRD.md` and `docs/SDD.md` (its ADRs are the decision log); read only the sections a ticket links |
| Glossary | `CONTEXT.md` |
| Past reviews | `docs/reviews/`, a record of what was found, not of what is true today |
| Contracts | `packages/universal/api-contracts` (the committed OpenAPI document), `packages/server/job-contracts`, `packages/server/env-schema`, error codes in `packages/universal/errors` |
| CI | `.github/workflows/`, required checks in `.github/BRANCH_PROTECTION.md` |
| Deploy config | `infra/compose`, `infra/k8s`, `infra/terraform` |

Two cautions:

- **The docs can run ahead of the code** (`docs/agents/collaboration.md`, Facts), so
  `AGENTS.md`, `ARCHITECTURE.md` and `docs/SDD.md` witness intent, never what exists.
- **Most tickets, docs and code came out of the same authoring sessions**, so nearly every
  doc is SELF-ATTESTED against the code. An AGREED fact here is a review approval or a decision
  the owner made in a PR thread.
