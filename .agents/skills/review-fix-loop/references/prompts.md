# Reviewer and fixer prompts

A reviewer prompt is the common header, a role block and the common footer, plus the
evidence block for Cold teammate, Roadmap fit and Plan / spec doc. The Simplifier's whole
brief is `simplifier.md`. The fixer template is at the end.

## Common header

```
Read-only: do not edit, create or delete files, do not stage or commit, do not switch
branches (the working tree is in use). Read code with `git -C <repo> show <ref>:<path>`.
Repo: <abs path>. Scope: `git -C <repo> diff <base>..<head>` plus untracked <files>.
Spec: <path>. Plan: <path>. Read the repo's AGENTS.md (or CLAUDE.md) and the standards
it points to.
This change is <what it is>. It is NOT <what a later slice or ticket does>, so do not ask
for that here. Stay inside the range, no exhaustive sweeps.
```

## Common footer

```
Known and accepted, do not re-report: <list from earlier rounds>.
Report only real findings with file:line, why it matters (a concrete failure or the rule
it breaks) and a concrete fix, ranked blocker / major / minor / nit. Zero findings is
fine; say "clean" plainly. Under <N> words.
```

## Evidence block

```
Judge scope against independent evidence: the ticket <path or link> (requirements and
out-of-scope list), the design docs <paths>, sibling tickets <ids>, earlier review
agreements <links>. The spec and plan come from the code's author: they are not evidence
that a choice was agreed.
```

## Standards, round 1

```
Check the rules tooling misses, read from their homes: <the repo's standards docs>, the
skills <comment-discipline, test-discipline, react-conventions as relevant>. Skip anything
a linter, formatter or type checker already enforces.
```

## Standards, round N

```
Round N. These changed since the last round; for each, say addressed or not and whether
it introduced a new problem, then look once more at the whole range for anything real that
was missed, correctness included: <numbered list of fixes>.
```

## Bug hunter

```
Hunt for real behaviour regressions. Compare old (`git show <base>:<path>`) with new.
Check edge inputs, null and empty semantics, ordering and timing, error paths, every
caller of a changed signature, and tests that now pass vacuously. You may run the scoped
specs read-only. Report only confirmed or highly plausible bugs, each with a failure
scenario (inputs or state -> wrong output).
```

## Cold teammate

```
Role-play a senior engineer assigned to review this PR cold. You have seen no discussion.
Be blunt. Answer: first impression; too much for one PR (yes/no, realistic review time);
which parts are in scope and which go beyond the ticket, and whether to accept, split or
drop each (name commits); what would make it reviewable; risks needing manual testing. If
a PR body exists, judge it as the reviewer who has to use it: does "How to review this"
get you to the decision quickly, and does anything in it waste your time.
```

## Roadmap fit

```
Read the next tickets on this surface: <ids or paths>. For each, does this change make it
an extension (a row, an argument, a new implementation of an existing interface) or a
rewrite? What debt does it leave and which ticket pays it? Rank what remains by how much
it helps.
```

## Plan / spec doc

```
Check the document against the code on the real branches and against its own
requirements. Report with line numbers: factual errors (file, symbol, behaviour), internal
inconsistencies, conflicts that need a spec update, requirements no step covers, stale
names.
```

## Final verdict

```
Final-verdict reviewer before this goes out. Verdict on prod readiness and safety
(migrations, config defaults, rollback, data that outlives the release), correctness
against the requirements it claims, approach and scope, test quality (coverage against
ceremony). End with SHIP / SHIP WITH NITS / FIX FIRST and the must-fix list.
```

## Fixer (the only agent that edits)

```
You are the fixer for round <N> of a review loop, the only agent that edits this round.
Work only in your own worktree of <repo abs path>, on <branch, or detached at <sha> when
the user's checkout holds it>. Never touch the user's checkout or uncommitted changes (no
commit, stage, stash or patch of them). Do not push, do not post anywhere.

Load first: <skills>. Read: <docs, spec and plan paths>,
.agents/skills/review-fix-loop/references/pitfalls.md (Fixes, Git).

What this change is: <one paragraph>. It is NOT <what a later slice or ticket owns>.

Agreements from the session (binding, do not revisit): <the user's decisions and
corrections, in their words where wording matters>.

Fix exactly these, nothing else:
1. <file:line> - <problem> - <the fix> - <why>
2. ...

Do not fix (decided skips, with reasons): <list>. Known and accepted: <list>.

Then run the gate: <commands>, until green. Commit per logical group in the repo's commit
format, ASCII only, no AI credit, never `--no-verify`. If a change of the user's is in the
way, stop that step and report it.

Report: per numbered finding done / not done and why; files touched; gate commands with
counts; commit shas. If you disagree with a fix, report it instead of changing or dropping
it. Under <N> words.
```
