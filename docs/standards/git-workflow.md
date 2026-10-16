# Git Workflow & Pull Request Standards

This document specifies the branching, code review, merge policy, and CI standards for the `video-pipeline` monorepo.

---

## 1. Branch Protection & PR Barrier (Strict Rule)

Direct pushes and direct merges to the `main` branch are strictly blocked by GitHub branch protection rules.

Every feature, ticket, and bug fix MUST adhere to the following workflow:
1. **Branch Naming:** Create a dedicated branch off `main` named `ticket/<NN>-<slug>` for tickets (e.g. `ticket/42-threaded-comments`) or `<type>/<slug>` for non-ticket changes (e.g. `chore/biome-error-on-warnings`). A ticket sliced into several PRs uses the stack names in §2.
2. **Pull Request Requirement:** Submit all changes exclusively through a GitHub Pull Request targeting `main`; a slice targets the branch below it in its stack (§2).
3. **Formal Approval:** A PR into `main` needs one approving review from the repository owner before it merges; a slice PR into its ticket's feature branch is merged by the agent loop once its review is clean (§2). Agents act as the PR's author, so their reviews are `COMMENT`, never `APPROVE`, and an agent never merges around the required review.
4. **All CI Checks Green:** All GitHub Actions status checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) must pass green. Merging with failing status checks is strictly forbidden.

---

## 2. Large Tickets Ship as a Stack

A ticket whose plan has more than one PR ships as a native GitHub stack managed with `gh stack`, planned before its first commit:

- **Feature branch** `feat/<NN>-<slug>` off `main`, its PR titled `NN: <ticket title>` and kept as a draft until every slice is in. It holds only the commit that sets the ticket `in-progress`, the squashed slices and merges of `main`.
- **Slice branches** `slice/<NN>a-<slug>`, `slice/<NN>b-<slug>`, ..., each stacked on the one below, the bottom one on the feature branch. Each slice PR is titled `<NN>a: <slice title>`, reviewed on its own, and green on its own; the top slice sets the ticket `done`.
- **Merging, bottom-up:** the stack's lead lands each clean slice into the feature branch with `gh stack merge`; the owner reviews and squash-merges the feature PR into `main`, one commit per ticket.

The mechanics (opening, syncing after a lower slice changes or merges, the exact commands) are `git-and-pr-conventions`, `references/stacked-prs.md` and `references/this-repo.md`, under `.agents/skills/`.

---

## 3. Squash-and-Merge Policy

Standard merge commits (`--merge`) and rebase merges (`--rebase`) are disabled repository-wide.

- **Squash-Only:** Merges to `main` must ALWAYS use **Squash and Merge** (`--squash`).
- **Squash Commit Format:**
  - For ticket-based PRs:
    ```
    NN: <ticket title> (#<pr_number>)
    ```
    Example: `42: Threaded comments keyset pagination & moderation (#84)`
  - For a slice PR, squashed into its ticket's feature branch:
    ```
    NNa: <slice title> (#<pr_number>)
    ```
  - For non-ticket PRs:
    ```
    <type>(<scope>): <description> (#<pr_number>)
    ```
    Example: `docs(standards): extract testing and git workflow guidelines (#85)`

---

## 4. Agent Review Loop

Agents review a PR on GitHub, one review per round, and fix through a fixer that replies in each thread with
the fixing commit. The loop, its roles and the hand-off to the owner are the `ticket-loop` skill for a batch of
tickets and the `review-fix-loop` skill for a single change, both under `.agents/skills/`; the GitHub mechanics
are `git-and-pr-conventions`, `references/review-on-github.md`.

---

## 5. Ticket Status Synchronization

`main` takes no direct push, so a ticket's status changes inside its PR:
1. The PR that starts a ticket sets its `**Status:**` line to `in-progress`; the PR that completes it sets `done` (a stack: the feature branch's first commit and the top slice). Those two are the only statuses set by hand: `gen-index.py` derives `blocked` and `ready` from each ticket's blockers and writes them back to the ticket, and `blocked-by-date` falls back to `blocked` while a blocker is open. It refuses anything outside `ready`, `blocked`, `in-progress`, `done` and `blocked-by-date`.
2. Re-generate the index in the same PR: `python3 docs/tickets/gen-index.py`. CI runs it with `--check` (`tests/in-process/gen-index.test.ts`, in `pnpm test:unit`), so a stale index or a status that disagrees with its blockers fails the PR.
3. After the merge, `.github/workflows/sync-tickets.yml` updates the GitHub issues on the push to `main`; `pnpm sync:tickets` does the same by hand.
