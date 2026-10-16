# Worktrees

One PR or one stack, one worktree. Work that is not on the user's checked-out branch never
happens in the user's checkout.

## Create

- Outside the repo, never nested inside it (a nested worktree sits in a folder the repo
  ignores, and editors and git tools then refuse it). A worktree pool manager (such as
  `treehouse`) hands out warm ones; `git worktree add <path> <branch>` otherwise.
- A branch can be checked out in one worktree only: a reviewer or a second reader works
  detached at the sha (`git worktree add --detach <path> <sha>`); worktrees share the
  object store, so a local-only commit is reachable.
- Warm it before work: install from the lockfile (`--frozen-lockfile`), build what the
  packages consume. Two running worktrees collide on dev-server ports and container names:
  run one at a time.
- An agent gets its worktree before it is spawned and is told the absolute path; its shell
  stays bound to that directory for its whole run.
- **Show it in the user's editor in the same command that creates it**, and take it out
  before it is destroyed. Edit the right window's saved workspace file, never the
  editor's command line (`code --add` lands in whichever window was focused last); the
  helper and this repo's workspace file: `this-repo.md`.

## A stack

Every branch of a stack (`stacked-prs.md`) lives in the one worktree: a branch can be
checked out in one worktree only, and gh-stack rebases the branches nobody holds in place.
Agents take turns in it: one editor at a time, each ending its turn on a commit and a push,
the next moving to its slice with `gh stack bottom`, `up` or `down`. Reviewers need no
checkout; one that must run a slice works detached at its sha (above).

## Work

Commit small and push after every commit: a crashed session or a restarted agent loses
only what is not on the remote.

## Destroy, in this order

1. **The work is safe**: `git -C <wt> status --short` prints nothing, and
   `git -C <wt> rev-parse HEAD` equals the merged PR's head
   (`gh pr view <n> --json state,headRefOid`); a stack's worktree goes only after its
   feature PR merged, with every slice's local head equal to its merged PR's head. Decide
   from the PR, never from `git branch --merged` or the pool tool: a squash-merged branch
   looks unmerged to both.
2. **Uncommitted work worth keeping** is stashed with a message saying what and why
   (`git -C <wt> stash push -u -m "<branch>: <what>"`): the stash list is shared by every
   worktree, so it survives the destroy.
3. **Release the editor's hold**: remove the folder from the editor's workspace file first
   (Create); a language server holding it blocks deletion.
4. **Remove it**: `git worktree remove <wt>`, then `git worktree prune`; with a pool, its
   own destroy command. A pool's flags that skip its own safety checks are used only when
   steps 1 to 3 passed and no live agent is in the worktree; the pool this repo uses:
   `this-repo.md`.

Never force-remove a worktree git or the pool refuses for a reason you have not checked,
and never remove one a live agent is still running in: its shell dies with it.
