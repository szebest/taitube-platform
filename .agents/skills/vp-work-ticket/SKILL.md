---
name: vp-work-ticket
description: Pick up and deliver one video-pipeline ticket (docs/tickets/NN-slug.md) end to end — read only the linked PRD/SDD sections, implement the vertical slice with TDD, prove every acceptance criterion, respect local-first and dual-runtime rules, update the ticket status and regenerate the index. Use whenever asked to "work on / implement / do ticket NN" in this repository.
license: MIT
metadata:
  project: video-pipeline
  pairs-with: implement, tdd, code-review, verification-before-completion, handoff
---

# Work a video-pipeline ticket

Tickets are tracer-bullet vertical slices in `docs/tickets/`, numbered in dependency order. The index `docs/tickets/README.md` has the status board, dependency graph and the frontier (tickets whose blockers are all done). This skill is the repo-specific wrapper around `implement`.

## 1. Claim
1. Open `docs/tickets/README.md`; confirm the ticket is on the frontier (all `Blocked by` tickets show `done`). If not, stop and say which blocker is missing.
2. Set the ticket's `**Status:**` line to `in-progress`, run `python3 docs/tickets/gen-index.py`, commit on branch `ticket/NN-slug`.

## 2. Load context — and nothing else
- Read the ticket fully. Then read **only** the PRD/SDD anchors in its `Spec` row. The SDD is ~18k words; the links are your context budget.
- Skim `docs/agents/domain.md` rules and `CONTEXT.md` if present (glossary vocabulary: *rendition*, *ladder*, *generation*, *stage*, *fencing token*, *effectively-once*).
- If the ticket links `.env.example`, `packages/job-contracts` or a DDL section, treat those as the contract: change them **and** the SDD together or not at all.

## 3. Build the slice (use `tdd`)
- Vertical: schema → package → app → test → docs, in one branch. No "I'll add tests later".
- Every **Acceptance criterion** becomes a test, or — when it is a manual demo (playback, dashboard, autoscaling graph) — a recorded artefact (screenshot/GIF/PNG/result table) committed under the path the ticket names.
- Non-negotiables to check before every commit:
  - **Local-first (SDD P9 / PRD G11):** no new runtime call to anything outside Docker Compose; `.env.example` defaults still all-local; no CDN-loaded scripts; telemetry disabled.
  - **Dual runtime:** anything under `apps/worker` or shared `packages/*` used by workers must pass under `vitest` **and** `bun test`; no `Bun.*` APIs.
  - **Contracts:** job payloads/ids only via `@vp/job-contracts`; object keys only via `packages/storage/keys.ts`; every video state transition via the CAS helper that also writes `video_events`.
  - **Errors:** throw `PermanentError`/`TransientError` with a code from SDD §6.2 — never a bare `Error`.
- Decision the ticket does not cover? Choose the option most consistent with the SDD ADRs, record it under the ticket's *Open questions* as `Decided: …`, and flag it in the PR.

## 4. Prove it (use `verification-before-completion`)
Run and paste the output of: `pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm test:integration` / `bun test` where relevant, `make smoke` for tickets ≥ 08). Then walk the ticket's AC list and tick each with evidence.

## 5. Hand off
- **Prepare PR & Start Review:** Push branch, open PR, and initiate `code-review` against the ticket (spec axis) and standards axis.
- **Strict Green CI Gate in DoD:** Verify that all GitHub Actions CI jobs (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) pass green. The reviewer (or implementing agent) MUST raise a blocking issue if any CI check fails. **Forbid merging or finishing/marking a ticket as done if any CI check is failing.**
- **Update Architecture, Docs & README:** If any features, endpoints, commands, schemas, boundaries, workspace packages, or architecture decisions changed or were introduced, ensure `README.md`, `ARCHITECTURE.md`, and `docs/SDD.md` (and its ADRs) are updated and consistent. Keep `README.md` accurate, professional, human-written (no emojis, no AI clichés), and continuously improved.
- Set `**Status:**` to `done` only after CI is green, re-run `python3 docs/tickets/gen-index.py`, sync ticket status to GitHub Issues / Project board via `pnpm sync:tickets` (or automatic CI workflow), update the SDD/PRD if a decision changed, write a `handoff` note if the next ticket is for another agent.
- PR title `NN: <ticket title>`; body = AC checklist with evidence links + decisions made + documentation updates.
