# This repo

The rules are `docs/standards/git-workflow.md`: branch names, squash merge only and the
squash subject, the required checks, and a ticket's status changing inside its PR. The
PR template is `.github/PULL_REQUEST_TEMPLATE.md`: the reviewer half of
`references/pr-body.md` goes into its Summary, and Verification & Evidence takes the tail
of each gate's output.

**Worktree pool**: agents get `treehouse` worktrees. A merged one is destroyed with
`treehouse destroy <wt> --include-leased --include-in-use --include-unlanded --yes`, and only
once it is clean, its head equals the merged PR's head, no live agent is in it, and it was
`code --remove`d. `--include-unlanded` is needed because treehouse reads a squash-merged
branch as unlanded; `--include-in-use` only because an editor or language server can still
hold the folder.
