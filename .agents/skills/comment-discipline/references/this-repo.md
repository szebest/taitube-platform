# This repo

- **No work-item reference at all**, not even after a real constraint:
  `tests/architecture/no-process-comments.test.ts` fails on the word "ticket", an AC, a
  `#123`, a numbered step or a workstream id (`W3`) in any comment or test title under
  `apps/`, `packages/`, `scripts/` and `tests/`. An ADR (`ADR-24`) or an SDD section (`SDD §6.2`)
  stays allowed: it names a decision that outlives the work.
- **Lint suppressions are Biome's**: `// biome-ignore <rule>: <reason>`, and the reason
  follows SKILL.md.
