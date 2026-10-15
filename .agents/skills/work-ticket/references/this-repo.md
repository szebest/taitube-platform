# This repo

- **Tickets** are `docs/tickets/<NN>-<slug>.md`, numbered in dependency order; read the
  `Blocked by` row, not the number. The board, graph and frontier are
  `docs/tickets/README.md#frontier`.
- **Status**: set only `in-progress` and `done` by hand in the `**Status:**` line, then run
  `python3 docs/tickets/gen-index.py`, which derives `blocked` and `ready` and writes them
  back (`docs/standards/git-workflow.md`, Ticket Status Synchronization).
- **Branch** `ticket/<NN>-<slug>`; the PR title and squash subject `NN: <ticket title>`.
  A stack's branch names and titles: `docs/standards/git-workflow.md`, section 2.
- **Large** means the ticket table's `Size | L`: those get the slicing decision.
- **Context**: the ticket's `Spec` row links the `docs/PRD.md` and `docs/SDD.md` sections to
  read; the SDD is long, so read only those. Vocabulary: `CONTEXT.md` and
  `docs/agents/domain.md`.
- **Non-negotiables** are the numbered rules of the root `AGENTS.md`; the ones a slice most
  often trips: local-first (`local-first-check`), dual runtime (worker and shared package
  specs pass under `pnpm test:bun`, no `Bun.*` API), single-sourced contracts (job
  payloads in `@vp/job-contracts`, object keys in `packages/server/storage/src/keys.ts`,
  state through the CAS helper, `postgres-cas-fencing`), errors classified at the throw
  site.
- **The gate**: `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm test:bun` for worker
  and shared package code, `pnpm test:architecture`, `pnpm boundaries`, and `make smoke`
  when the stack is involved.
- **The PR** follows `.github/PULL_REQUEST_TEMPLATE.md`; `main` needs an approval the PR
  author cannot give, so the owner merges.
