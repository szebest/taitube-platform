# This repo

The rules are `docs/standards/git-workflow.md`: branch names, squash merge only and the
squash subject, the required checks, and a ticket's status changing inside its PR. The
PR template is `.github/PULL_REQUEST_TEMPLATE.md`: the reviewer half of
`references/pr-body.md` goes into its Summary, and Verification & Evidence takes the tail
of each gate's output.

## Merging

**Into `main`, the owner merges.** `main` needs one approval no agent can give (every
agent runs as the PR's author); an agent never passes `--admin` or merges around the
review. The command handed to the owner, for a single-PR ticket or a stack's feature PR
once its slices are in:

```sh
gh pr merge <N> --repo szebest/taitube-platform --squash --subject "<NN>: <ticket title> (#<N>)" --delete-branch
```

**Into a feature branch, the stack's lead merges.** The feature branch has no protection
and the owner reviews the ticket on its feature PR, so the lead lands each clean slice
itself, bottom-up, as soon as it and every slice below it are clean:

```sh
gh pr ready <each slice PR up to the highest clean one>
gh stack merge <highest clean slice PR> --squash --yes
gh stack sync --prune
```

The squash subject is the PR title plus ` (#N)` (the repository's squash title setting),
so a PR's title is its final subject from `gh pr create` on: slices land in the feature
branch as `<NN>a: <slice title> (#N)`, and `main` gets one commit per ticket. After the
feature PR merges, the firstmate deletes the slice branches
(`git push origin --delete slice/<NN>a-<slug> ...`). Stacks are enabled on the repository
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
