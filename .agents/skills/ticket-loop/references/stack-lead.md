# Leading a stack

A ticket sliced into more than one PR ships as a gh-stack: a feature branch plus one slice
PR per slice, mechanics in `git-and-pr-conventions`, `references/stacked-prs.md` (read it
before the plan). One lead runs the whole stack in one worktree. Section 1 here is
SKILL.md §3 step 2 for a stack, sections 2 and 3 replace steps 3 to 8, and every other
rule there still holds.

## 1. Plan the stack before any code

A `Plan` agent (Opus or Fable, high effort: the plan is crucial and has to be right first
time) reads the ticket, the docs it links and the code it touches, and returns the slices:

- **Bottom-up by dependency**, each one reviewable in one sitting
  (`git-and-pr-conventions`, Size) and green on its own.
- **One kind per slice**: a folder move alone, a refactor with no behaviour change, then
  the behaviour, then deploy or infra; the acceptance criteria each slice proves.
- **What each slice is not**, so its reviewers do not ask for the next one's work.

The lead checks the plan against the ticket, then opens the feature branch and its draft
PR with the plan in the body (`stacked-prs.md`, Opening) and sends the firstmate:

```
Stack plan for ticket NN: feature PR #F (feat/NN-slug), <k> slices.
a  slice/NNa-<slug>  <what it holds>  ACs <ids>  ~<lines>
b  slice/NNb-<slug>  <what it holds>  ACs <ids>  ~<lines>
Starting with a. Conflicts with: <PRs and files or none>
```

The firstmate puts it in the next owner report. Building starts at once; a correction from
the owner reshapes only the slices not yet pushed.

## 2. Build bottom-up, review behind it

- **One implementer at a time owns the worktree**, slice by slice: commit, push after
  every commit, the slice's PR on its first push, `gh stack link` with the full list, then
  `gh stack add` for the next slice. Its model follows the slice's own size (SKILL.md §4),
  not the ticket's.
- **Review runs one slice behind**: when slice a's last commit is pushed, its first review
  round starts on `git diff feat/NN-slug...slice/NNa-slug` while the implementer builds b.
  Reviewers read with `git show` and need no checkout.
- **A fix on a lower slice** (`stacked-prs.md`, Keeping it current): the implementer
  stops at its next commit and pushes; the fixer takes the worktree, fixes, rebases
  upstack, pushes, replies in the threads, and hands the worktree back. Never two crew
  members editing at once, never a second worktree.
- **A conflict in the cascade** goes to a Sonnet crew member at medium effort with the
  slice's reviewed content as the target; the lead checks `git diff <below>...<slice>`
  shows only that slice's work afterwards.
- **`main` moved**: a crew member takes it into the feature branch as `stacked-prs.md`
  says; a run with no conflict is Sonnet at low effort.

## 3. Clean, hand-off, merge

The stack is clean when every slice is clean (`git-and-pr-conventions`,
`references/review-on-github.md`, Clean), the feature PR's history holds only what
`stacked-prs.md` allows, and a final-verdict reviewer on a model no slice round used reads
`origin/main...feat/NN-slug` whole and says SHIP. The lead then rewrites the feature PR's
body with the whole-ticket evidence and sends:

```
Stack for ticket NN clean. Feature PR #F, slices #A (a), #B (b), #C (c); top at <sha>.
CI green on every slice. Rounds per slice: a <k>, b <k>, c <k>. Final verdict: SHIP.
Behaviour changes the owner should know: <bullets or none>
Conflicts with: <PRs and files or none>
```

The owner may land clean bottom slices early with the same commands; the lead then runs
`gh stack sync --prune` and carries on above. Once the feature PR merges, the firstmate
runs `gh stack unstack --local` in the worktree, then destroys it
(`git-and-pr-conventions`, `references/worktrees.md`). The commands handed to the owner: `git-and-pr-conventions`,
`references/this-repo.md`.
