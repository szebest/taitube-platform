# This repo

The rules that decide placement here are the numbered rules of the root `AGENTS.md`;
`ARCHITECTURE.md` is the authority where they disagree. How sections 4 and 6 apply here
(the parsers in use, `assertNever`, `knip`, the generated files):
`docs/agents/making-changes.md`. In the terms of SKILL.md:

- **Where business logic lives**: domain services over the ports in `@vp/core`; input-only
  rules in `@vp/validation`, rules that need an entity in `@vp/domain-rules`. Routes and
  worker stages unwrap results; they decide nothing (`docs/standards/error-handling.md`).
- **Variance behind an interface**: ports and adapters, composed once per deployable (the
  `hexagonal-port-adapter` skill).
- **Shared layers**: a package's directory under `packages/` is its runtime tier and its
  `vp.layer` is its dependency layer; `packages/AGENTS.md` decides where a shared unit may
  go, and `pnpm boundaries` checks it.
- **Single-sourced contracts**: job payloads, object keys, error codes and environment
  config each have one home (root `AGENTS.md`, rule 3); a change to one updates
  `docs/SDD.md` in the same PR.
- **The docs can run ahead of the code**: verify a claim against the source before building
  on it (`docs/agents/collaboration.md`, Facts).
