# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **[`CONTEXT.md`](../../CONTEXT.md)** at the repo root — the glossary and the seam discipline.
- **[`docs/SDD.md` §4 — Architecture Decision Records](../SDD.md#4-architecture-decision-records)** — read the
  ADRs that touch the area you are about to work in.

**This repo has no `docs/adr/` directory and is not getting one.** Every ADR lives inline in SDD §4 as
`### ADR-NN — <title>`, numbered sequentially. Wherever a skill tells you to read `docs/adr/`, read SDD §4
instead; wherever one tells you to *write* an ADR, append a new `### ADR-NN` section there. One file keeps
the decisions next to the design they constrain, and the tickets already link into it by anchor.

There is one context, so there is no `CONTEXT-MAP.md` and no per-context ADR directory. If a skill looks for
either, proceed silently — do not flag the absence and do not create them.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name),
use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the
project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-19 (hexagonal architecture), but worth reopening because…_

---

## video-pipeline specifics

- Glossary terms to use verbatim (from PRD §13 and `CONTEXT.md`): *rendition*, *ladder*, *generation*,
  *stage*, *fan-out/fan-in*, *DLQ*, *stalled job*, *fencing token*, *effectively-once*, *local-first*,
  *package tier*, *dependency layer*, *contract package*, *conformance suite*.
- The vocabulary for package structure is in [`packages/AGENTS.md`](../../packages/AGENTS.md), which SDD
  ADR-24 is the decision record for.
- An ADR that changes must be edited in place in SDD §4; a superseded one keeps its number and says which
  ADR replaced it.
