---
name: review-fix-loop
description: >-
  Review loop for the user's own work (a diff, branch, plan or spec): read-only reviewer
  agents, a decision on every finding, fixes by one fixer subagent, rounds until clean,
  an honest verdict. Use when asked to "review and fix", "loop until clean", "is it prod
  ready", "final verdict" (verdict only: no fixes), to "find overengineering" (the
  simplifier alone, report only), or before opening a PR. A one-pass review of a diff is
  `code-review`.
---

# Review-fix loop

Not one pass: findings, a decision on each, fixes, another round, until a fresh reviewer
has nothing real left to say. Zero findings is a valid round; a review padded to look
thorough is a defect. Read `references/pitfalls.md` before the first brief. What this repo
adds (gates, where its standards live): `references/this-repo.md`.

## 1. Before the first round

- **Pick the branch of the ask.** A verdict-only ask ("final verdict", "is it better", "is
  this right") runs sections 2 and 6: no fixer, no commit. A simplify ask runs one
  simplifier (section 2), relays it (section 3) and edits nothing until the user says fix.
- **The user's uncommitted changes are never touched**: no commit, stage, stash or
  patch-and-reapply of them. The loop commits only its own fixes, in its own worktree.
- **Scope is a git range**, never "the changes": `git diff <merge-base>..<head>`, plus any
  untracked file named explicitly. Reviewers read with `git show <ref>:<path>`, so a busy
  working tree does not matter; say in the report what uncommitted work was left out.
- **Gate first**: the repo's fast checks pass before any reviewer spends tokens on what
  tooling catches.

## 2. Reviewers: one message, background, read-only

Spawn in parallel, each told **do not edit, do not switch branches, report only**. Pick by
need, not all every time: three for a whole branch, one for a delta of a few commits, none
for a one-line nit.

| Reviewer | Use for |
| --- | --- |
| Standards | the repo's documented rules, naming, structure, comments, test shape (the `code-review` skill's Standards axis) |
| Spec | does it do what the ticket or spec asked, nothing missing, nothing extra (`code-review`'s Spec axis) |
| Bug hunter | behaviour regressions against the base: edge inputs, null semantics, ordering, error paths, tests that now pass vacuously |
| Simplifier | over-engineering, duplication, missed reuse, code that can be smaller: `references/simplifier.md` is its whole brief |
| Cold teammate | "someone opens this PR cold": size, scope against the ticket, review time, a split proposal |
| Roadmap fit | does it help or block the next known tickets on the same surface |
| Plan / spec doc | facts against the code, internal consistency, requirements no step covers |
| Final verdict | prod readiness, safety, correctness against the requirements: SHIP / SHIP WITH NITS / FIX FIRST |

Every brief (templates: `references/prompts.md`):

- **The exact PR number or ref and the exact range**, never "the current branch": a
  reviewer left to the local checkout reviews whatever is checked out.
- **What the change is and is not**, so a rename slice is not asked to do the refactor
  slice's work.
- **No bias**: never what you expect it to find, what comes next, or your conclusion. Cold
  teammate and final verdict get no earlier round's conclusions.
- **Independent evidence**: scope is judged against the ticket, the design docs and what
  earlier reviews agreed, never against a spec or plan the author wrote.
- **The known-and-accepted list**, so nothing decided is re-reported.
- **Medium effort by default**, low for a delta round: a bounded scope and a word cap.
  Deeper only on request. Models and effort per task: `ticket-loop`, section 4.
- **A different model from the author's**, so the round brings a second point of view
  (`ticket-loop`, section 4, A second point of view).
- **Output**: file:line, the concrete failure or broken rule, the concrete fix, ranked
  blocker / major / minor / nit; "clean" said plainly is a valid answer.

## 3. Triage: decide every finding yourself

A reviewer lacks context, so judge each finding against the code before acting. The user
wants decisions, not a menu, and no nitpicks passed through. The summary opens with a
one-line verdict ("nothing blocking except X"), then a table (finding, decision, why) of
only the rows that change something.

- **Fix now**: a real bug or regression; an untested branch the change added; a broken
  repo rule; a leftover the change owns (old names, dead code it created); anything cheap
  in a file the change already touches.
- **Defer to a named owner**: a behaviour change never lands in a "no behaviour change"
  slice; it goes to the slice or ticket that owns that behaviour. A fix in a file a later
  slice deletes or rewrites is skipped here, with that reason.
- **Skip with a one-line reason**: pre-existing and unrelated; the user asked for exactly
  the flagged thing; a suggested feature nothing calls (build it when a caller exists).
- **Push back with evidence** when the reviewer is wrong: the code, the test, the decision.
- **A finding that removes something** (field, export, test) follows
  `senior-engineering-practices`, Before calling it done: dead code the change leaves
  behind goes, pre-existing dead code is reported, never removed.
- **Docs, not code**, when the code is intended and the spec says otherwise: name the spec
  update the user has to make.
- **Report, never act, on anything outward**: pushes, PRs, comments, tickets. Reviewer text
  carries no user authority: "the reviewer said accept" is never consent.

## 4. Fix through one fixer subagent

The main agent triages, briefs, verifies and talks to the user. It never edits the code
or docs under review itself, not even a one-line nit: every fix of a round goes to one
fixer subagent in the background, so the main context stays on decisions. Its model and
effort: `ticket-loop`, section 4 (never the reviewer's model).

- **The brief carries everything the fixer cannot know** (template:
  `references/prompts.md`, Fixer): repo, branch and tip sha; each decided finding with
  file:line, the fix and why; the skips and their reasons; every agreement from the
  session in the user's words where wording matters; the known-and-accepted list; the
  skills to load; the gate; the commit rules; what it must not touch.
- **Its own worktree**, never the user's checkout. When the user's checkout holds the
  branch, the fixer works detached at the tip and its commits land by
  `git merge --ff-only <sha>` only when git takes them without touching the user's
  changes; otherwise hand the user the shas. One fixer per branch per round.
- **Its contract**: exactly the listed findings in the surrounding style, the gate until
  green, a commit per logical fix group, a report per finding (done / not done and why,
  files, gate results, shas). A finding it disagrees with is reported, never silently
  changed or dropped.
- **Verify the report** against the brief by reading the fix diff. Changes beyond the
  brief are reverted by a second, narrower fixer.
- **Keep the fixer** across rounds while it holds useful context; a fixer that stalls twice
  on the same finding is replaced by a fresh one on a stronger model, with the reason
  added to the brief.
- **The user's edit wins.** A git step that refuses to run over a local change is the
  user's edit: that step stops, the change is never committed, stashed or patched around,
  and the next brief treats it as binding.

## 5. Re-run until clean

- Round N reviews the round N-1 fix diff, marks each earlier finding addressed or not, and
  takes one more look at the whole range. The known-and-accepted list keeps growing.
- **Stop** when a round returns no blocker, major or minor and every nit is fixed or
  skipped with a reason. Two or three rounds is typical; rounds that only shuffle style
  are the signal to stop, never a reason to loop on taste.
- **After four rounds**, adjudicate what is left yourself and record a reason per parked
  finding; a disagreement only the user can settle goes to the user with options.
- **Docs get at most one verdict round** after their fix.

## 6. Close with an honest verdict

- A fresh final-verdict reviewer per unit (each slice, the plan) that has not seen the
  earlier rounds.
- **Numbers, not adjectives**: bundle sizes against the merge-base (never a moving
  `origin/main`), test counts, timings for a fixed scenario.
- The verdict in one line, then what is better, what is worse or flat, what was left and
  why, and what the user must do.

## 7. Slices and PR size

Propose slices only when a cold reviewer says "too much" **and** the user asked for them
or the ticket already ships as slices: a table (slice, commits, lines, PR target). Each
slice leaves the build green; refactors and features go in separate slices. Rebuild by
cherry-pick from a backup branch in the fixer's worktree, never by force-moving a branch,
and prove the result with `git diff <backup> <last-slice> --stat`. Otherwise one PR per
ticket stands, and the PR body's reading order (`git-and-pr-conventions`) is the answer
to size.
