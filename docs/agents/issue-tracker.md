# Issue tracker: Local Markdown (`docs/tickets/`)

Issues for this repo live as one markdown file per ticket in `docs/tickets/`, generated with the `to-tickets` method and indexed by `docs/tickets/README.md` (status board, dependency graph, parallel lanes). This file adapts the skills' "local markdown" convention to that layout.

## Conventions

- Tickets: `docs/tickets/NN-<slug>.md`, numbered from `01` in **dependency order** (blockers have lower numbers, except a foundation ticket added later, which keeps the next free number and may block lower-numbered tickets; the graph stays acyclic). One ticket per file, never a combined file.
- Ticket body: header table (`Phase`, `Size`, `Blocked by`, `Blocks`, `Spec` links to PRD/SDD anchors), a `**Status:**` line holding one word of `ready` | `blocked` | `in-progress` | `done` | `blocked-by-date` (`gen-index.py` refuses anything else), then `## What to build`, `## Acceptance criteria` (checkboxes), `## Out of scope`, `## Notes for the implementer`, `## Testing plan`, `## Open questions`, `## Definition of Done`.
- `Blocked by` is authoritative. `Blocks`, the frontier, the status board, the Mermaid graph and the lane table are **generated**: run `python3 docs/tickets/gen-index.py` after any change (it also validates PRD/SDD anchors, and CI runs it with `--check`).
- Specs are the PRD (`docs/PRD.md`) and SDD (`docs/SDD.md`); a feature spec produced by `to-spec` goes to `docs/specs/<feature-slug>.md`.
- Comments/decisions append to the ticket under `## Open questions` as `Decided: …` lines, or under a `## Comments` heading.

## Definition of Done (DoD)

A ticket cannot be marked `done` or merged until all of the following are satisfied:
1. **All Acceptance Criteria Pass:** Every AC is implemented with verifiable test/demo evidence.
2. **Local Verification Clean:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `bun test` all pass with zero errors.
3. **Branch Protection & PR Approval (Strict Barrier):** Direct push or merge to `main` is blocked. Changes must be submitted via a GitHub Pull Request from `ticket/<NN>-<slug>`. The reviewer reviews the PR on GitHub, leaving line/summary comments. The implementor applies fixes or replies with technical rationale in a persistent agent loop until the reviewer submits formal PR approval (`APPROVE`).
4. **Green CI Build & Checks:** All GitHub Actions CI checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) MUST pass green. Merging or finishing any ticket with failing CI checks is strictly forbidden.
5. **Documentation, Architecture & README:** `README.md`, `ARCHITECTURE.md`, and `docs/SDD.md` (and relevant ADRs) are updated for any additions or architectural changes.
6. **Index & Tracker Synchronized:** the PR that completes the ticket sets `**Status:** done` and re-runs `python3 docs/tickets/gen-index.py` (`main` takes no direct push); the issues sync on the merge.

## When a skill says "publish to the issue tracker"

Create `docs/tickets/NN-<slug>.md` with the next free number **after every ticket it is blocked by**, using the template at the bottom of `docs/tickets/README.md`; set `**Status:** ready`; run `gen-index.py`.

## When a skill says "fetch the relevant ticket"

Read `docs/tickets/NN-*.md`. The number alone identifies the ticket.

## Triage roles

A triage label a skill would apply as `ready-for-agent` is the `ready` status here (all tickets are agent-grabbable by construction). `needs-info` may be set on a ticket whose Open questions block work; `wontfix` moves a ticket to `docs/tickets/archive/`.

## Wayfinding operations (if `wayfinder` is installed)

Map: `docs/tickets/map-<effort>.md`; child tickets are ordinary tickets with `Type:` and `Status:` lines; blocking via `Blocked by`; the frontier is the generated list in [`docs/tickets/README.md`](../tickets/README.md#frontier).
