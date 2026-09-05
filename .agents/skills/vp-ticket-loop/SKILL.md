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
┌─────────────────────────────────────────────────────┐
│                    FIRSTMATE (you)                   │
│  read board → pick ticket(s) → spawn worker(s)      │
│  ↳ worker done → spawn reviewer → fix loop          │
│  ↳ review clean → commit → record notes → next      │
└─────────────────────────────────────────────────────┘
```

---

## 0. Prepare — read the frontier

1. Open `docs/tickets/README.md`. Parse the status board table.
2. Identify every ticket whose status is `ready` (all blockers `done`).
   These form the **frontier**.
3. If the frontier is empty, report "No actionable tickets — all remaining
   tickets are blocked or done" and stop.

## 1. Decide: serial or parallel?

Look at the frontier tickets. They can run in parallel **only if** they share
no files and no package dependencies (check their `Blocked by` and `Blocks`
columns, and skim the "What to build" section for overlapping packages).

- **Single ticket on the frontier → serial mode.** Work on `main` branch directly.
- **Multiple independent tickets → parallel mode.** Each ticket gets its own
  branch and git worktree.

### Parallel setup (only if multiple tickets)

For each ticket `NN`:
```
git branch ticket/NN-slug main
git worktree add ../worktree-NN ticket/NN-slug
```
After each worker finishes and review passes, merge back:
```
git checkout main
git merge ticket/NN-slug --no-ff -m "NN: <ticket title>"
```
If a merge conflict occurs, spawn a dedicated `resolving-merge-conflicts`
subagent to handle it, then re-run verification on main.

Remove worktrees after merge:
```
git worktree remove ../worktree-NN
git branch -d ticket/NN-slug
```

### Serial setup (single ticket)

```
git checkout -b ticket/NN-slug main
# ... worker does work ...
git checkout main
git merge ticket/NN-slug --no-ff -m "NN: <ticket title>"
git branch -d ticket/NN-slug
```

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
   > verification (`pnpm typecheck && pnpm lint && pnpm test`) before claiming
   > done. Respect local-first (no external services), dual-runtime (vitest +
   > bun test for worker code), and all AGENTS.md rules. Update the ticket
   > status to `done` and run `python3 docs/tickets/gen-index.py`. When
   > finished, respond with a structured completion report (see format below).
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

Wait for the worker to complete. Do NOT poll — the system notifies you.

---

## 4. Spawn the reviewer

Once the worker reports completion, spawn a **reviewer** subagent:

- Type: `self`, Model: `inherit`
- Role: `Ticket NN Reviewer`
- Prompt: Tell it to use the `code-review` skill. Include:
  - The diff command: `git diff main...ticket/NN-slug`
  - The spec: `docs/tickets/NN-slug.md`
  - Ask it to also run `pnpm typecheck && pnpm lint && pnpm test` independently
    (verification-before-completion — don't trust the worker's claim).
  - Output format: a structured review with `## Standards`, `## Spec`,
    `## Verification`, and a final `## Verdict: PASS | FAIL` line.
  - If FAIL, list each finding with a fix instruction.

### Review-fix loop

- If the reviewer says **PASS** → proceed to step 5.
- If the reviewer says **FAIL**:
  1. Send the reviewer's findings to the **original worker** via `send_message`.
     Tell the worker: "The reviewer found these issues. Fix them and report back."
  2. Wait for the worker to report the fixes are done.
  3. Send a message to the **reviewer**: "The worker applied fixes. Please
     re-review: run the diff and verification again."
  4. Wait for the reviewer's updated verdict.
  5. Repeat until PASS (max 3 rounds — if still failing after 3 rounds, stop
     the loop and report the situation to the user).
- **Keep the reviewer alive** until it passes. Only kill it after PASS.

---

## 5. Commit and merge

After review passes:

1. Tell the worker to make a final commit:
   ```
   git add -A && git commit -m "NN: <ticket title>"
   ```
2. If on a branch (not main), merge to main (see §1 for commands).
3. Kill both the worker and reviewer subagents.
4. Record the worker's **completion report** — especially the
   "Notes for the next agent" section — in your memory. You will paste this
   into the next worker's briefing.

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
