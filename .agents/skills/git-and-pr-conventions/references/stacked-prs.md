# Stacked PRs with gh-stack

A ticket whose plan has more than one PR ships as a **stack**: a feature branch for the
ticket and one slice branch per PR on top of it, managed with `gh stack` (the
`github/gh-stack` extension). Each slice PR shows only its own layer, GitHub draws the
stack map on every PR, and gh-stack keeps each branch rebased on the one below. A branch
cut from another ticket's unmerged branch ships the same way, with that branch as trunk.
Flags are in `gh stack <command> --help`; this file holds what the help does not say.

## Shape

```
slice/<NN>c-<slug>   PR "<NN>c: <slice title>"    base slice/<NN>b-<slug>   top
slice/<NN>b-<slug>   PR "<NN>b: <slice title>"    base slice/<NN>a-<slug>
slice/<NN>a-<slug>   PR "<NN>a: <slice title>"    base feat/<NN>-<slug>     bottom
feat/<NN>-<slug>     PR "<NN>: <ticket title>"    base main                 trunk
```

- **The feature branch is the stack's trunk.** It holds the commit that starts the
  ticket, the squashed slices and merges of `main`, nothing else: nobody writes code on
  it. Its PR stays a draft until every slice is in.
- **Slices are lettered in plan order**, bottom first, and are never renamed or
  relettered. Each leaves the build green on its own; a refactor, a behaviour change and a
  folder move (SKILL.md, Moves) are separate slices.
- Write "#N (slice b) targets slice a", never an arrow between them: an arrow reads as
  already merged.

## Plan the stack before the code

The slicing plan exists before the first implementation commit, as a table in the feature
PR's body (`pr-body.md`, A stack): slice, branch, what it holds, the acceptance criteria it
proves, an estimate of changed lines. The body is the plan's one home and is rewritten
when a slice changes. A slice found late goes on top, with the next free letter.

## Opening

From the stack's worktree (`worktrees.md`):

```sh
git fetch origin && git switch -c feat/<NN>-<slug> origin/main
# commit 1: the ticket marked started, the way the repo marks it
git push -u origin feat/<NN>-<slug>
gh pr create --draft --base main --title "<NN>: <ticket title>" --body-file <feat body>
gh stack init --base feat/<NN>-<slug> slice/<NN>a-<slug>
# slice a's first commit, then at once:
gh stack push
gh pr create --draft --base feat/<NN>-<slug> --head slice/<NN>a-<slug> --title "<NN>a: <slice title>" --body-file <body>
# after slice a's last commit, from the top of the stack:
gh stack add slice/<NN>b-<slug>
# slice b's first commit, push, its PR with --base slice/<NN>a-<slug>, then:
gh stack link --base feat/<NN>-<slug> <a-pr> <b-pr>
```

- **Every PR opens on its branch's first push**, with its real title and body. Skip
  `gh stack submit`: its editor needs a terminal and `--auto` invents titles.
- **`gh stack link` always gets `--base` and the full list**, bottom to top, each time a
  slice PR opens (it only adds). Without `--base` it retargets the bottom PR to `main`;
  repair with `gh stack unstack <stack-number>` and link again.
- `gh stack add` runs only from the top branch.

## Keeping it current

- **A slice branch moves only through gh-stack.** Commit on the slice (`gh stack bottom`,
  `down`, `up` to reach it), then `gh stack rebase --upstack` and `gh stack push`. Never
  merge the branch below or `main` into a slice: GitHub merges a stack only when the
  history between its branches is linear. This is the one place a pushed branch is
  rebased; `gh stack push` force-pushes each branch behind its own lease.
- **A fix on a lower slice reaches the slices above within the hour**: rebase upstack and
  push right after the fix commit, so no review or build runs on a stale slice.
- **`main` moved**: merge it into the feature branch, never rebase the trunk:
  `gh stack trunk`, `git merge origin/main --no-edit`, the gates, `git push`, then
  `gh stack sync` (fetch, cascade rebase, push, relink). Generated files are regenerated,
  never hand-merged.
- **A slice merged**: `gh stack sync --prune`. GitHub has already retargeted the next slice
  to the feature branch and rebased the rest; sync brings the worktree in line.
- **A rebase conflict**: `sync` restores every branch and stops. Run `gh stack rebase`,
  resolve to the slice's reviewed content on the new base, `git add`, then
  `gh stack rebase --continue` (`--abort` restores everything).
- gh-stack stops on a worktree holding a stack branch that is dirty or busy, and never
  stashes: commit or wait, then run it again. In a non-interactive shell a diverged stack
  aborts `sync` without pushing; compare `gh stack view` with
  `gh api repos/<owner>/<repo>/stacks?pull_request=<n>` before relinking.

## CI and review per slice

- CI runs on every slice PR as if it targeted the stack's base, so the workflow's
  `pull_request` trigger must not filter on branches. A slice merges only when it and
  every slice below it are green and meet the rules.
- **Each slice is reviewed on its own PR**, range `git diff <branch below>...<slice>`, with
  its own rounds (`review-on-github.md`). The feature PR gets no full review: once every
  slice is in, one check that its history holds only the starting commit, squashed slices
  and merges of `main` and that any conflict fix is right, then the final verdict on
  `origin/main...feat/<NN>-<slug>`.

## Merging, bottom-up

1. **Slices into the feature branch**: mark them ready (`gh pr ready <n>`), then
   `gh stack merge <highest clean slice PR> --squash --yes`. It merges that slice and every
   unmerged one below, atomically, one squash commit per slice; a middle slice never
   merges alone. `gh stack merge` takes no subject, so the squash subject is whatever the
   repo builds from the PR title: get the title right at `gh pr create`.
2. **The feature PR into the default branch**, once the last slice is in, the branch is
   current with `main` and CI is green: one squash commit for the whole ticket.
3. **Clean up**: delete the slice branches on the remote, then `gh stack unstack --local`.

Who runs which step, and the exact commands: `this-repo.md`. A merge into the default
branch is never made around its required review.

## Without gh-stack

Branches already cut from one another by hand:

- **Adopt them** when they still line up: `gh stack init --base <trunk> <bottom> ... <top>`,
  then `gh stack link --base <trunk> <PRs bottom to top>`.
- **A child whose base squash-merged**: merging the target into the child conflicts on
  every line both changed, though the content is the same. Abort that merge and move only
  the child's own commits: `git rebase --onto <target> <sha the child was cut from>
  <child>` (lost the sha: `git merge-base <child> <old base tip>`). Check that
  `git diff <target>...<child>` shows only the child's work, then push with
  `--force-with-lease=<child>:<old child sha>`.
- **Before a base branch is deleted**, retarget every PR on it:
  `gh pr edit <n> --base <new base>`. A merge with `--delete-branch` removes the base, and
  GitHub closes the PRs that targeted it.
- Re-merging the default branch after a squash of a branch you already merged conflicts on
  every file both sides changed, and auto-merged files can silently re-add lines your
  branch removed. Take `--ours` only after `git diff --stat <old tip> <squash> -- <files>`
  is empty, then compare `git diff --name-only ORIG_HEAD HEAD` against the files of the
  commits that only the default branch has.
