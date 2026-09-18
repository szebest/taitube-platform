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

## 5. Hand off & PR Review-Fix Loop
- **Branch Protection & PR Requirement:** The `main` branch is protected against direct pushes and merges. All code must be developed on `ticket/NN-slug`, pushed to `origin`, and merged exclusively through a GitHub Pull Request with at least one approval.
- **Open Pull Request:** Push the branch to `origin`, open a PR against `main`, and share the PR URL in user chat.
- **Persistent Agents & PR Review:** The reviewer agent inspects the Pull Request on GitHub, leaving line and summary review comments on the PR. **Both the implementor and reviewer agents remain alive throughout the review-fix loop.**
- **Evaluate & Address Feedback:** The orchestrator relays reviewer feedback via agent messaging. The implementor evaluates each comment and either applies code fixes (pushing new commits to the branch) or replies with clear technical rationale explaining why a comment is not applicable. Once addressed, the reviewer re-evaluates the PR.
- **Strict Green CI Gate & Required Approval in DoD:** All GitHub Actions CI checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) MUST pass green, and the reviewer MUST formally approve the PR (`APPROVE`). Forbid merging or marking a ticket done if any CI check fails or review is pending.
- **Merge PR & Ticket Sync:** Once approved and CI is green, merge the PR into `main`. Update `README.md`, `ARCHITECTURE.md`, `docs/SDD.md` if applicable, set ticket `**Status:** done`, re-run `python3 docs/tickets/gen-index.py`, and sync tickets. Only after merge is complete are subagents terminated.
- PR title `NN: <ticket title>`; body = AC checklist with evidence links + decisions made + documentation updates.
