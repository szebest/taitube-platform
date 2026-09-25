# 34: Node 26 LTS upgrade and dependency refresh (after 2026-10-28)

| Field | Value |
|---|---|
| Phase | 4 — Resilience & cloud (time-gated) |
| Issue | [#34](https://github.com/szebest/taitube-platform/issues/34) |
| Size | S |
| Blocked by | 08 — Containerise + compose |
| Blocks | — |
| Spec | [SDD §17 Fact sheet (Node.js row)](../SDD.md#17-fact-sheet-verified-2026-09-03) · [SDD §15.2 Toolchain](../SDD.md#152-toolchain) · [SDD §18 Phase 4](../SDD.md#phase-4--resilience--cloud--34-weeks) |

**Status:** blocked-by-date

Ready after Node 26 enters Active LTS on 2026-10-28.

## What to build
The API image, `.node-version`, `engines`, CI matrix and Dockerfiles move from Node 24 to Node 26 LTS; Bun to the current 1.x; BullMQ/Fastify/Drizzle to current minors (Drizzle 1.0 if GA, with the migration guide applied). The smoke, E2E and load-smoke suites stay green; image sizes and cold-start numbers are re-measured and noted in SDD §2.3.

## Acceptance criteria
- [ ] Node 26 in `.node-version`, `engines`, `node:26-slim` base, CI matrix (keep 24 in the matrix for one release as a safety net).
- [ ] `pnpm outdated` clean for majors we chose to take; Renovate PRs merged or explicitly deferred with a note.
- [ ] `make smoke`, `make e2e`, nightly `load-smoke` green; Bun/Node parity job green.
- [ ] SDD §15.2 and §17 updated with new versions/dates.

## Out of scope
Feature work.

## Notes for the implementer
- If Drizzle 1.0 GA introduces breaking changes to the CAS/`onConflict` helpers, keep 0.45 and open a follow-up ticket instead of forcing it.

## Testing plan
Full existing suites.

## Open questions
- None.

## Definition of Done
- [ ] Merged; SDD updated.
