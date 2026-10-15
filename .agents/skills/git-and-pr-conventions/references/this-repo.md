# This repo

The rules are `docs/standards/git-workflow.md`: branch names, squash merge only and the
squash subject, the required checks, and a ticket's status changing inside its PR. The
PR template is `.github/PULL_REQUEST_TEMPLATE.md`: the reviewer half of
`references/pr-body.md` goes into its Summary, and Verification & Evidence takes the tail
of each gate's output.

## Merging

`main` needs one approval no agent can give (every agent runs as the PR's author), so the
owner merges; an agent never passes `--admin` or merges around the review. The squash
subject is the PR title plus ` (#N)` (the repository's squash title setting), so a PR's
title is its final subject from `gh pr create` on. The commands handed to the owner:

```sh
# a single-PR ticket
gh pr merge <N> --repo szebest/taitube-platform --squash --subject "<NN>: <ticket title> (#<N>)" --delete-branch

# a stack: the slices into the feature branch, bottom-up, then the feature PR into main
gh stack merge <highest clean slice PR> --squash --yes
gh pr ready <feature PR>
gh pr merge <feature PR> --repo szebest/taitube-platform --squash --subject "<NN>: <ticket title> (#<feature PR>)" --delete-branch
git push origin --delete slice/<NN>a-<slug> slice/<NN>b-<slug>
```

Slices squash into the feature branch as `<NN>a: <slice title> (#N)`; `main` gets one
commit per ticket. Stacks are enabled on the repository
(`gh api repos/szebest/taitube-platform/stacks` answers with a list, not a 404), and
`ci.yml`'s `pull_request` trigger runs on every slice.

## Worktrees

**Pool**: agents get `treehouse` worktrees, leased from the main checkout
(`treehouse get --lease --lease-holder <ticket>-<role>`); a stack leases one for all its
slices. A merged one is destroyed with
`treehouse destroy <wt> --include-leased --include-in-use --include-unlanded --yes`, and
only once `references/worktrees.md`, Destroy, steps 1 to 3 passed and no live agent is in
it. `--include-unlanded` is needed because treehouse reads a squash-merged branch as
unlanded; `--include-in-use` only because an editor or language server can still hold the
folder.

**The owner's editor**: the window is the saved multi-root workspace
`taitube-platform.code-workspace` at the root of the main checkout (git-excluded, repo
root first). A worktree goes in and out with
`~/.claude/bin/ws-folder add|remove <that file> <wt>`, chained onto the lease and run
before the destroy; the window reloads its folders live. Never remove the root folder:
replacing a workspace's first folder restarts the editor's extension host and every
session in it.
