# This repo

- **Where the standards live**, for the Standards reviewer: the root `AGENTS.md` (its
  numbered rules), the `AGENTS.md` of every package and app the range touches,
  `docs/standards/`, and `ARCHITECTURE.md`. A rule `tests/architecture/` already enforces
  is tooling: reviewers skip it.
- **The gate**, fast checks first: `pnpm typecheck`, `pnpm lint`, the touched packages'
  specs (`pnpm --filter <package> test`), then `pnpm test`, `pnpm test:bun` when worker or
  shared package code moved, `pnpm test:architecture` and `pnpm boundaries`. Commands and
  scopes: `docs/standards/testing.md`, Commands.
- **Spec for the Spec reviewer**: the ticket in `docs/tickets/`, and only the `docs/PRD.md`
  and `docs/SDD.md` sections its Spec row links.
- **A finding that contradicts an ADR** in `docs/SDD.md` is a docs change before it is a
  code change: the ADR and the code move in the same PR.
