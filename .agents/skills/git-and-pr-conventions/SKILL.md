---
name: git-and-pr-conventions
description: >-
  Git and GitHub rules: commit and PR title format, the PR body that gets a PR reviewed
  fast, branches, stacked PRs, move-only PRs, merge commits, reviewing someone else's PR.
  Use before any commit message, branch, push, PR create or body edit, stack, folder move,
  merge of one branch into another, or review of another person's PR.
---

# Git and PR conventions

The repo's own branch names, squash format and PR template: `references/this-repo.md`.
Its rules win where they are stricter; everything else here applies everywhere.

## Commits

- **Subject**: Conventional Commits, `<type>(<scope>): <subject>`, ASCII, lowercase,
  imperative ("if applied, this commit will ..."), no trailing period, about 50
  characters and never past 72. A breaking change gets `!` after the scope and a
  `BREAKING CHANGE:` footer.
- **Body**, when the subject is not the whole story: a blank line, then what changed and
  why, wrapped at 72, never how (the diff says how). No "fix bug", "phase 1", "address
  review".
- Multi-line messages go through `git commit -F <file>` after
  `LC_ALL=C grep -n '[^ -~]' <file>` prints nothing.
- **Merge commits**: let git write the subject (`Merge branch 'main' into <branch>`): no
  `-m`, no hand-written or Conventional Commits subject. A short body explaining a
  non-obvious conflict resolution is welcome.
- **No AI credit** anywhere: no `Co-Authored-By` trailer for a tool, no "generated with"
  line, in commits, PR bodies or comments. Templates and tools add them: re-read the exact
  text before every commit and PR write.
- Never `--no-verify`, `--force` or `-f`. A rewritten branch of your own goes out with
  `--force-with-lease=<branch>:<old sha>`.

## Branches

- **One branch and one PR per ticket**, even when a plan lists several steps (they become
  commits), unless the user asks for slice PRs or the work moves folders (Moves).
- **One PR, one worktree.** Work that is not on the checked-out branch goes into its own
  worktree; never switch the user's checkout away from what they are running. Creating,
  warming and the checks before destroying one: `references/worktrees.md`.
- **Merge, do not rebase, a pushed branch.** Bring it up to date by merging the base in
  (`git merge origin/main --no-edit`). Rebase only commits nobody else has, and one case
  more: a child whose base squash-merged moves with
  `git rebase --onto <target> <cut sha> <child>`, never a merge (a merge conflicts on
  every line the squash repeated).
- **A branch cut from another branch**: bring the base up to date first, then cut from it,
  and note the sha you cut from. Any branch on another non-default branch ships as a
  stack: `references/stacked-prs.md` before opening, retargeting or merging its PRs.

## Moves

**A folder restructure ships alone**, in two commits: `git mv` of whole folders with every
file byte-identical, then only the path edits the move forces. Symbol renames and any code
edit go in another PR. Counts and rename checks: `references/moves.md`, read before the
first `git mv`.

## Size

One self-contained change per PR, its tests included. About 100 changed lines reviews
easily, about 1000 is too big unless it is a move or generated output. Refactors and
behaviour changes go in separate commits at least, separate PRs when either is large.
Each commit of a stack leaves the build green.

## PR title and body

- **Title**: the commit subject format; the squash commit reuses it.
- **The body is mandatory on anything non-trivial** and is the part most easily
  forgotten. Before any PR create or body edit, read `references/pr-body.md` and fill its
  skeleton merged into the repo's own PR template. Voice: `prose-conventions`.
- **A body edit starts from the live copy**: refetch it, change only your lines, keep
  everything someone else wrote, refetch after the write to confirm.
- **When the branch changes after the PR opened**, rewrite the body to match, unasked and
  in place, never as an appended changelog.
- **Open the PR on the first push**, as a draft when the work is unfinished: the PR is the
  review surface, and a pushed branch without one is invisible.
- **Review on the PR itself** when an agent loop reviews it: one review per round, a reply
  with the fix's sha in every thread. Mechanics: `references/review-on-github.md`.

## Doing it

When the user says commit, push or open the PR in plain words, do it end to end and report
what landed with links; ask only when a real fork has no default. A request for text only
("write the commit message") gets the text.

## Reviewing someone else's PR as the user

Read-only: `gh pr view`, `gh pr diff` and `git show`; a separate worktree only if you must
run it, never the user's checkout. Voice and what is worth raising: `prose-conventions`,
Reviewing someone else's PR.

1. Read the ticket and its requirements, the diff, the existing review comments (never
   repeat one) and the open PRs touching the same files: when one edits the same block,
   say so in one line.
2. Anchor each comment on a diff line (`git diff <base>...<head> -U0`).
3. A merged PR gets a plain comment framed as a follow-up.
4. Verify the posted anchors with `gh api repos/<owner>/<repo>/pulls/<n>/comments`.
