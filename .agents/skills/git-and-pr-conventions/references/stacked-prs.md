# Stacked PRs

A branch that sits on another non-default branch ships as a stack: each PR targets the
branch below it, and the bottom PR targets the trunk.

| Stack | Trunk: the branch the bottom PR merges into |
| --- | --- |
| slices of one ticket | the ticket's feature branch |
| sub-branches of an epic | the epic branch |
| a ticket cut from another ticket's branch | the parent ticket's branch, then the default branch once it merges |

`gh stack` (the `github/gh-stack` extension) draws the stack on each PR, retargets the PR
above when one merges and cascades the rebase. Without it, the same rules hold by hand.

## Opening a stack

1. Open each PR with its real title and body (`pr-body.md`), bottom first, each based on
   the branch below. Skip any command that opens an editor or invents titles.
2. With `gh stack`: `gh stack link --base <trunk> <bottom-pr> ... <top-pr>`. Always pass
   `--base`: without it the trunk is the repo default and the bottom PR silently retargets
   to it (repair: `gh stack unstack <n>` and link again).

## The slice merge model

- A feature branch starts at the default branch's tip; open its PR at once, on an empty
  first commit (`git commit --allow-empty`), so the slices have a target.
- Slice PRs squash into the feature branch; the feature PR squashes into the default
  branch.
- Slice branch names never change, and slices are never renumbered.
- Say "PR #N (slice 1) targets the feature branch", never "slice 1 -> feature": the arrow
  reads as already merged.

## CI on a stack

CI must run on a PR whose base is not the default branch, or every PR above the bottom one
merges untested: a `pull_request` trigger without a `branches` filter does it. A squash of
the bottom PR changes the tree under the next one, and a retarget alone fires none of the
default `pull_request` events: merge the new base in and push, so the checks run on what
will merge.

## Keeping it current

- Restack with `gh stack rebase` or `gh stack sync`, not hand-chained rebases.
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
