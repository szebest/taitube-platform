# Issue tracker: Local Markdown (`docs/tickets/`)

Issues for this repo live as one markdown file per ticket in `docs/tickets/`, generated with the `to-tickets` method and indexed by `docs/tickets/README.md` (status board, dependency graph, parallel lanes). This file adapts the skills' "local markdown" convention to that layout.

## Conventions

- Tickets: `docs/tickets/NN-<slug>.md`, numbered from `01` in **dependency order** (blockers have lower numbers). One ticket per file, never a combined file.
- Ticket body: header table (`Phase`, `Size`, `Blocked by`, `Blocks`, `Spec` links to PRD/SDD anchors), a `**Status:**` line (`ready-for-agent` | `in-progress` | `done` | `blocked-by-date`), then `## What to build`, `## Acceptance criteria` (checkboxes), `## Out of scope`, `## Notes for the implementer`, `## Testing plan`, `## Open questions`, `## Definition of Done`.
- `Blocked by` is authoritative. `Blocks`, the status board, the Mermaid graph and the lane table are **generated**: run `python3 docs/tickets/gen-index.py` after any change (it also validates PRD/SDD anchors).
- Specs are the PRD (`docs/PRD.md`) and SDD (`docs/SDD.md`); a feature spec produced by `to-spec` goes to `docs/specs/<feature-slug>.md`.
- Comments/decisions append to the ticket under `## Open questions` as `Decided: …` lines, or under a `## Comments` heading.

## When a skill says "publish to the issue tracker"

Create `docs/tickets/NN-<slug>.md` with the next free number **after every ticket it is blocked by**, using the template at the bottom of `docs/tickets/README.md`; set `Status: ready-for-agent`; run `gen-index.py`.

## When a skill says "fetch the relevant ticket"

Read `docs/tickets/NN-*.md`. The number alone identifies the ticket.

## Triage roles

Only `ready-for-agent` is used (all tickets are agent-grabbable by construction). `needs-info` may be set on a ticket whose Open questions block work; `wontfix` moves a ticket to `docs/tickets/archive/`.

## Wayfinding operations (if `wayfinder` is installed)

Map: `docs/tickets/map-<effort>.md`; child tickets are ordinary tickets with `Type:` and `Status:` lines; blocking via `Blocked by`; frontier = lowest-numbered ticket whose blockers are all `done` and which is not `in-progress`.
