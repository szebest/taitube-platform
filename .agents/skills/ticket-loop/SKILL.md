---
name: ticket-loop
description: >-
  Orchestrating many tickets or PRs in parallel with agents: you are the firstmate, one
  lead per ticket, PR or stack, leads run their crews on fitting models, review happens on
  GitHub, the owner merges. Use to "work through the tickets", "loop the backlog",
  "continue the open PRs", or resume a loop a previous session left mid-flight.
---

# Ticket loop

Three tiers, each doing only its own job. This repo's board, conflict-prone files and
skills: `references/this-repo.md`. A ticket sliced into several PRs is a stack, run by one
lead: `references/stack-lead.md`.

```
firstmate (you)   board, batches, roster, cross-PR relay, merge hand-off to the owner
  └─ lead         one per ticket, PR or stack: owns its branches, worktree, PRs, review loop
       └─ crew    planner, implementer, reviewer, fixer, CI diagnoser, comment poster
```

The firstmate writes no product code and runs no gates. A lead writes no product code
either: it briefs crew, triages findings, keeps the PR moving and talks to other leads.

## 0. Read the state

**Resuming** (open PRs or worktrees exist) is the usual case:

1. `git worktree list`; per ticket branch, the local head against the PR head and any dirty
   files.
2. Open PRs with head, base, CI rollup and the last few reviews and comments; for a stack,
   `gh stack view` in its worktree as well.
3. The previous firstmate session's transcript: its last messages, its unanswered
   questions to the owner, and which crew worked which PR. Give each lead the transcript of
   the crew that worked its PR before.

**Fresh**: the ready tickets (every blocker done), read from the ticket files on a freshly
pulled default branch, plus any "do this next" decision the owner has recorded.

Done when every open PR and every ticket you will act on has a one-line state.

## 1. Batches

Leads idle cheaply, their crews do not. Run **at most four leads at once**, about eight
live agents in all: past that, the session's rate limit kills agents mid-task. Order
batches by the merge graph: stack roots and CI fixes first, then what is closest to merge,
then work that conflicts with everything (dependency upgrades, folder moves) last, alone.
A stack gets **one lead** and one worktree for all its PRs.

## 2. Spawn a lead

A background general-purpose agent on Opus at medium effort (judgement, little output).
Its worktree exists before the spawn: an existing one is reused, a new one is leased and
shown in the owner's editor in the same command (`git-and-pr-conventions`,
`references/worktrees.md`). The brief is self-contained:

- PR(s), branch, worktree path, ticket path, the state from §0, the previous transcript,
  the owner's open decisions that touch it.
- **The roster**: the other leads' names, their PRs and the files each owns or is likely
  to conflict on. Send a roster update to every lead whenever one is spawned or finishes.
- The lead's loop (§3), the crew rules (§4), the coordination rules (§5) and the hand-off
  format (§6), pasted, plus `references/stack-lead.md` for a ticket that is or may become
  a stack: a lead never loads this skill.
- The rules the owner restated in this repo that agents keep getting wrong, verbatim.

## 3. The lead's loop

1. **PR on the first push.** No branch lives on the remote without a PR; the PR body says
   what is still in progress. From then on every crew member pushes after every commit: a
   session restart kills every agent, and work that is not on the remote is at risk.
2. **Slice or not**, before any code: a large ticket gets a slicing decision first (one
   PR, or a stack), and a stack runs as `references/stack-lead.md` says.
3. **Implement** (if unfinished): one implementer with `work-ticket`, `tdd`,
   `verification-before-completion` and the domain skills the ticket touches.
4. **Review on GitHub**: a fresh reviewer per round posts one review on the PR, per
   `git-and-pr-conventions`, `references/review-on-github.md`. Round 2 and later review the
   delta plus the open threads.
5. **Triage** every finding as `review-fix-loop`, section 3, decides: fix, push back in
   the thread with the reason, or defer to a named ticket.
6. **Fix**: a fixer applies the batch, runs the gates, pushes, replies in each thread with
   the commit sha and resolves it. The lead does not wait for "all done": it starts the
   next round on what is already pushed, and chases each open finding by name.
7. **Green**: red CI goes to a CI diagnoser first (log, cause, flaky or real), then a
   fixer. A flaky check gets one rerun, never a second blind one. A check that times out
   or crosses a budget is fixed under it; raising the timeout or the budget is the owner's
   call, asked through the firstmate with the measurements.
8. **Clean** as `references/review-on-github.md` in `git-and-pr-conventions` defines it,
   plus the ticket marked done in the PR. The lead sends the hand-off (§6) and stays alive
   for the merge.

**The lead stays alive to the hand-off.** It ends its run only on the hand-off or a question
only the owner can answer; while crew works, it waits, and crew notifications and other
leads' messages resume it. A lead that returns a "progress report" with crew still running
orphans that crew. The harness still returns leads early, so crew reports landing at the
firstmate is the normal path: relay each one to its lead verbatim, which resumes it.

At most four rounds; a fifth means a disagreement only the owner can settle: the lead asks
through the firstmate, with options.

All prose posted to GitHub is the owner's voice (`prose-conventions`,
`git-and-pr-conventions`), and nothing credits a tool. Agents posting as the PR's author
review with `COMMENT`, never `APPROVE`.

## 4. Who does it, on which agent, model and effort

**Decide before every task, never by habit**:

- **Yourself**: small, with the context already loaded (a lookup you know where to find, a
  brief, a triage, a relay). The firstmate and leads still write no product code.
- **A crew member**, you staying the lead: medium or bigger work with a clear brief (an
  implementation, a review, a research sweep, a fix batch).
- **A lead**, which spawns its own crew: several parts to coordinate (a ticket, a stack).

Prefer a subagent for medium and bigger work: a fresh context does better, and its file
dumps never reach yours. Simple, low-stakes work that would still fill your context goes
to Haiku at low effort. A gate run or a CI log is a background shell
(`run_in_background`), never a subagent: a subagent costs a turn and hands back a summary
instead of the output.

| Agent type | For |
|---|---|
| `general-purpose` | anything that edits, runs commands or posts: lead, implementer, fixer, reviewer, CI diagnoser, poster |
| `Explore` | a broad read-only sweep across many files when only the answer matters (who calls X, which tickets touch Y); it locates, it does not review |
| `Plan` | a read-only design or a stack plan before a large ticket's first commit |
| `simplifier` | the over-engineering reviewer (`review-fix-loop`, `references/simplifier.md`); where the harness has no such type, `general-purpose` with that brief |

Every spawn sets a model and an effort: the pair that fits the task, not the cheapest one.
Routine work starts low and climbs one rung only when the output came back wrong or
shallow; say why it climbed. Work that is crucial or has to be right the first time (a whole
implementation, a stack plan, a risky migration, a final verdict, a root cause that resists
debugging) starts on a stronger model at higher effort: doing it once, well, beats a cheap
run and a redo. Reviewers and fixers run at medium or low unless the change is that
crucial.

| Job | Model | Effort |
|---|---|---|
| Lookups, CI and status polling, posting text already written, index or lockfile regeneration | Haiku | low |
| Mechanical edits with exact instructions (renames, table folds, thread replies), a base merge with no conflicts, a `gh stack sync` with no conflict | Sonnet | low |
| Conflict resolution, CI diagnosis, fixes whose fix the finding already states, a small ticket or slice | Sonnet | medium |
| Fixes that need a design call, a lead, a medium ticket or slice | Opus | medium |
| Review rounds | a model other than the author's (below) | medium (a delta round: low) |
| A large or design-heavy ticket, a stack plan, a bug that resists debugging | Opus or Fable | high |

**A second point of view**: a reviewer never runs on the model that wrote the code under
review, and a fixer never on the model of the reviewer whose findings it fixes. Opus
implemented it: Fable or Sonnet reviews it; Sonnet wrote the fix: Opus reviews the delta.
A final verdict on a large change, a whole stack included, takes a model no earlier round
used. An agent type that pins a model (the `simplifier` pins Opus) gets a spawn-time
override when the pin would make the reviewer the author.

Keep an implementer or fixer alive across rounds while it holds useful context, and
message it rather than spawning a new one; spawn reviewers fresh each round so they read
without bias. A crew member that died on an auth or network error is resumed by a message,
which keeps its context; never respawned from scratch.

## 5. Coordination between leads

Leads message each other directly by roster name, copying the firstmate on anything that
changes merge order.

- **Before touching a shared file**, tell the leads who also touch it.
- **Shared infrastructure lands once**: when two PRs need the same helper, the lead whose
  PR merges first builds it and the other waits for it to land. When waiting is not an
  option, the firstmate makes the two one stack under one lead; a PR never merges another
  open branch in.
- **On every push that changes a shared file**, send the other leads the sha and what
  changed.
- **On a merge to the default branch** (the firstmate relays it): every lead has its crew
  merge the default branch in, resolve conflicts toward both sides, and rerun the gates;
  a stack takes it into its feature branch and syncs (`references/stack-lead.md`).
- **A dependency major several PRs touch** has one owner (`senior-engineering-practices`,
  section 4): the leads agree who.
- Generated files (lockfile, generated contracts, indexes) are regenerated after a merge,
  never hand-merged.

## 6. Hand-off and merge

Lead to firstmate when clean:

```
PR #N (ticket NN) clean at <sha>. CI green. Rounds: <k>.
Behaviour changes the owner should know: <bullets or none>
Merge after: <PR or none>   Conflicts with: <PRs and files or none>
```

A stack sends its plan when it is made and its own hand-off when clean
(`references/stack-lead.md`).

The default branch needs an approval no agent can give, and agents never merge around it.
The firstmate test-merges the clean PRs against each other, then gives the owner the order
and the exact merge commands (`git-and-pr-conventions`, `references/this-repo.md`).

After the owner merges: pull the default branch, audit every ticket's status against its
blockers and the merges (a ticket whose PR merged is done; one whose blockers are all done
is ready), fix any drift in a PR, relay the merge to every lead (§5), release the lead,
destroy its worktree (`git-and-pr-conventions`, `references/worktrees.md`: the clean and
merged-head checks first), start the next batch.

## 7. Report to the owner

Lead with what needs them: PRs ready to merge (order and commands), questions only they can
answer, and every stack plan made since the last report, so a slicing they disagree with
is caught before its slices are built. Then one line per PR, in plain words, without
internal agent names. Never answer
"is it done?" with a status table alone: act first, then report. While a hand-off waits on
the owner's merge, a lead's status update is noise: batch them into the next report that
asks the owner for something.
