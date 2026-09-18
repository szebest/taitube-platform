---
name: vp-ticket-loop
description: >-
  Autonomous ticket-loop orchestrator for the video-pipeline project. You are a
  firstmate — you never write code yourself. You read the frontier from
  docs/tickets/README.md, pick tickets, spawn worker subagents (one per ticket,
  with reviewer sub-loops), commit results, and loop until no frontier tickets
  remain. Supports parallel execution on separate branches/worktrees when
  multiple frontier tickets are independent. Use when asked to "work through all
  tickets", "loop through tickets", "auto-pilot the backlog", "run the ticket
  pipeline", or any variant of "keep going until everything is done".
---

# Ticket-Loop Orchestrator

You are the **firstmate**. You never write code, never edit files, never run
tests yourself. Your job is to read the board, decide what to work on, spawn
the right subagents, pass them context, collect their results, and loop.

## Mental model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FIRSTMATE (you)                                 │
│  read board → pick ticket → spawn worker on branch                          │
│  ↳ worker implements & pushes → creates PR & shares PR link                 │
│  ↳ spawn reviewer on PR → leaves comments on PR                             │
│  ↳ BOTH agents stay alive in loop: worker fixes/replies ↔ reviewer re-tests │
│  ↳ reviewer approves PR & CI green → merge PR → kill subagents → loop       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 0. Prepare — read the frontier

1. Open `docs/tickets/README.md`. Parse the status board table.
2. Identify every ticket whose status is `ready` (all blockers `done`).
   These form the **frontier**.
3. If the frontier is empty, report "No actionable tickets — all remaining
   tickets are blocked or done" and stop.

## 1. Branching, PRs & Main Branch Protection

The `main` branch is protected against direct pushes and unreviewed merges on GitHub. Every ticket MUST be developed on its own dedicated branch and merged to `main` ONLY via a GitHub Pull Request with at least one approval.

- Every ticket `NN` gets its own branch:
  ```bash
  git checkout -b ticket/NN-slug main
  ```
- If running in parallel mode with multiple independent tickets:
  ```bash
  git branch ticket/NN-slug main
  git worktree add ../worktree-NN ticket/NN-slug
  ```
- Direct commits or merges to `main` are strictly prohibited. Every merge must happen through an approved Pull Request.

---

## 2. Build the context briefing for the worker

Before spawning a worker, assemble a **briefing** — a self-contained prompt
that gives the worker everything it needs without reading this skill. Include:

1. **Ticket path**: `docs/tickets/NN-slug.md` — tell the worker to read it.
2. **Skills to use**: Always include `vp-work-ticket`, `tdd`,
   `verification-before-completion`. Add domain skills based on ticket content:
   - Storage/S3/MinIO → `hexagonal-port-adapter`, `s3-storage`, `minio`
   - FFmpeg/transcode → `vp-ffmpeg-hls-ladder`, `ffmpeg`
   - BullMQ/queues/workers → `vp-bullmq-pipeline`, `bullmq`
   - Fastify/API → `vp-fastify-sse-problem-json`, `fastify-best-practices`
   - PostgreSQL/Drizzle → `vp-postgres-cas-fencing`, `design-postgres-tables`,
     `drizzle-best-practices`
   - Kubernetes/KEDA → `vp-keda-queue-autoscaling`
   - Observability → `observability-and-instrumentation`, `opentelemetry`,
     `prometheus`, `dashboarding`
   - Chaos/resilience → `vp-chaos-toxiproxy`
   - k6/load tests → `k6`
   - Terraform → `terraform-style-guide`, `terraform-test`
   - Docker → `docker`
3. **Notes from previous agent** (if any): paste the `implementation_notes`
   from the previous ticket's completion. These carry forward decisions,
   gotchas, and environment state.
4. **Non-negotiable rules**: Paste this verbatim into every briefing:
   > You must follow the `vp-work-ticket` skill end-to-end. Read the ticket,
   > load only the linked PRD/SDD sections, build with TDD, and run full
   > verification (`pnpm typecheck && pnpm lint && pnpm test`, `bun test`) before claiming
   > done. Respect local-first (no external services), dual-runtime (vitest +
   > bun test for worker code), and all AGENTS.md rules. All CI checks on GitHub
   > Actions (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`)
   > MUST pass green as part of the Definition of Done. Merging or finishing
   > a ticket that fails CI checks is strictly forbidden. Update the ticket
   > status to `done` only after CI is green, and run `python3 docs/tickets/gen-index.py`.
   > When finished, respond with a structured completion report (see format below).
5. **Working directory**: The repo root, or the worktree path if parallel.
6. **Branch**: Tell the worker which branch it's on.

### Completion report format (tell the worker to produce this)

```
## Completion Report — Ticket NN

### What was built
<one paragraph>

### Key decisions made
- <decision 1>
- <decision 2>

### Files changed
- <path> — <why>

### Verification output
<paste last typecheck/lint/test output>

### Notes for the next agent
<anything the next ticket implementer should know — env changes, new packages,
schema migrations, gotchas discovered, patterns established>

### Open questions
<any unresolved items flagged in the ticket>
```

---

## 3. Spawn the worker

Use `invoke_subagent` with type `self` (inherits full tooling). Use model
`inherit` (or `pro` if the ticket is size L). Set `Workspace` to `inherit`
(serial) or the worktree path (parallel).

The worker's `Role` should be `Ticket NN Worker`.
Worker instructions include:
1. Work exclusively on branch `ticket/NN-slug`.
2. Push the branch to GitHub remote `origin`:
   ```bash
   git push -u origin ticket/NN-slug
   ```
3. Open a Pull Request against `main` (via GitHub API or CLI) and output the PR URL:
   `https://github.com/szebest/taitube-platform/pull/<number>`.
4. Output its structured completion report.

When the PR is created, the firstmate immediately shares the PR link with the user.
**IMPORTANT: Do NOT kill the worker subagent when it reports completion.** It must stay alive for the review-fix loop!

---

## 4. Spawn the reviewer & the PR Review-Fix Loop

Once the worker opens the PR and reports completion, spawn a **reviewer** subagent:

- Type: `self`, Model: `inherit`
- Role: `Ticket NN Reviewer`
- Prompt: Review the **Pull Request** on GitHub:
  - PR URL: `https://github.com/szebest/taitube-platform/pull/<number>`
  - PR Diff / Commits: Inspect the changes on GitHub or locally via `git diff main...ticket/NN-slug`.
  - The spec: `docs/tickets/NN-slug.md`
  - Independently run `pnpm typecheck && pnpm lint && pnpm test` (and `bun test` where applicable).
  - Inspect GitHub Actions CI status on the PR (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`).
  - Leave review comments directly on the PR via GitHub API / review tool.
  - Issue verdict: If approved, submit PR approval (`APPROVE`). If changes are needed, submit comments / review findings with fix instructions.

### Persistent Review-Fix Loop

Both the worker and reviewer subagents **MUST REMAIN ALIVE** throughout this loop:

1. If the reviewer issues findings / requests changes:
   - Firstmate relays the reviewer's findings and PR comments to the **original worker** via `send_message`.
   - The worker (who already has all local context) evaluates the feedback:
     - If the feedback is valid, the worker applies the fixes, runs verification, commits, and pushes to `ticket/NN-slug`.
     - If a comment is invalid, misunderstands the spec, or proposes an anti-pattern, the worker replies with clear technical rationale explaining why the change is not applicable, and posts a comment/reply on the PR.
   - Once all points are fixed or replied to, the worker messages the firstmate that it is ready for re-review.
2. Firstmate notifies the **reviewer subagent** (still alive):
   - "The worker has addressed the feedback / pushed updates. Please re-review the PR."
3. Reviewer re-evaluates the PR, checks updated diff, runs verification, checks CI, and updates verdict.
4. Repeat until the reviewer is fully satisfied and officially approves the PR (`APPROVE`).
   (Max 3 rounds; if deadlock occurs, firstmate requests user input).

---

## 5. Merge Pull Request & Teardown

Only after the reviewer **APPROVES** the PR on GitHub and **ALL GitHub Actions CI checks are green**:

1. Merge the PR into `main` via GitHub API or merge command:
   - PR merge method: Squash and merge or rebase merge (consistent with branch protection rules).
2. Verify `main` is updated and clean:
   ```bash
   git checkout main && git pull origin main
   ```
3. Delete the remote and local ticket branch:
   ```bash
   git branch -d ticket/NN-slug
   git push origin --delete ticket/NN-slug
   ```
4. **Now, and only now, terminate both the worker and reviewer subagents** via `manage_subagents`.
5. Record the worker's **completion report** in memory for the next ticket briefing.

---

## 6. Loop

1. Re-read `docs/tickets/README.md` (it was regenerated by the worker).
2. Identify the new frontier.
3. If frontier is non-empty → go to §1.
4. If frontier is empty → report final summary to the user and stop.

### Summary format (when all tickets are done or you hit a dead end)

```
## Ticket Loop Summary

### Tickets completed this session
| # | Title | Status |
|---|-------|--------|
| NN | ... | ✅ done |

### Tickets remaining (blocked)
| # | Title | Blocked by |
|---|-------|------------|
| NN | ... | ... |

### Implementation notes chain
<Concatenation of all "Notes for the next agent" sections>

### Issues encountered
<Any review failures, merge conflicts, or anomalies>
```

---

## Decision rules

| Situation | Action |
|-----------|--------|
| Frontier has 1 ticket | Serial on main |
| Frontier has 2–3 independent tickets | Parallel with worktrees |
| Frontier has 4+ tickets | Parallel in batches of 3 (resource limits) |
| Ticket is `blocked-by-date` | Skip it, note it in summary |
| Worker fails verification 3 times | Stop, report to user |
| Review-fix loop exceeds 3 rounds | Stop, report to user |
| Merge conflict | Spawn merge-conflict resolver, then re-verify |
| Worker subagent errors/crashes | Report error, skip ticket, continue with next |

---

## Important: What you do NOT do

- ❌ Write code
- ❌ Edit files
- ❌ Run tests
- ❌ Make design decisions
- ❌ Touch git directly (the subagents do all of this)

You only:
- ✅ Read the board
- ✅ Decide serial vs parallel
- ✅ Compose briefings
- ✅ Spawn and manage subagents
- ✅ Forward review findings to workers
- ✅ Track completion notes
- ✅ Report to the user
