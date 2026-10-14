# Git Workflow & Pull Request Standards

This document specifies the branching, code review, merge policy, and CI standards for the `video-pipeline` monorepo.

---

## 1. Branch Protection & PR Barrier (Strict Rule)

Direct pushes and direct merges to the `main` branch are strictly blocked by GitHub branch protection rules.

Every feature, ticket, and bug fix MUST adhere to the following workflow:
1. **Branch Naming:** Create a dedicated branch off `main` named `ticket/<NN>-<slug>` for tickets (e.g. `ticket/42-threaded-comments`) or `<type>/<slug>` for non-ticket changes (e.g. `chore/biome-error-on-warnings`).
2. **Pull Request Requirement:** Submit all changes exclusively through a GitHub Pull Request targeting `main`.
3. **Formal Approval:** The PR needs one approving review from the repository owner before it merges. Agents act as the PR's author, so their reviews are `COMMENT`, never `APPROVE`, and an agent never merges around the required review.
4. **All CI Checks Green:** All GitHub Actions status checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) must pass green. Merging with failing status checks is strictly forbidden.

---

## 2. Squash-and-Merge Policy

Standard merge commits (`--merge`) and rebase merges (`--rebase`) are disabled repository-wide.

- **Squash-Only:** Merges to `main` must ALWAYS use **Squash and Merge** (`--squash`).
- **Squash Commit Format:**
  - For ticket-based PRs:
    ```
    NN: <ticket title> (#<pr_number>)
    ```
    Example: `42: Threaded comments keyset pagination & moderation (#84)`
  - For non-ticket PRs:
    ```
    <type>(<scope>): <description> (#<pr_number>)
    ```
    Example: `docs(standards): extract testing and git workflow guidelines (#85)`

---

## 3. Agent Review Loop

Agents review a PR on GitHub, one review per round, and fix through a fixer that replies in each thread with
the fixing commit. The loop, its roles and the hand-off to the owner are the `ticket-loop` skill for a batch of
tickets and the `review-fix-loop` skill for a single change, both under `.agents/skills/`; the GitHub mechanics
are `git-and-pr-conventions`, `references/review-on-github.md`.

---

## 4. Ticket Status Synchronization

`main` takes no direct push, so a ticket's status changes inside its PR:
1. The PR that starts a ticket sets its `**Status:**` line to `in-progress`; the PR that completes it sets `done`. Those two are the only statuses set by hand: `gen-index.py` derives `blocked` and `ready` from each ticket's blockers and writes them back to the ticket, and `blocked-by-date` falls back to `blocked` while a blocker is open. It refuses anything outside `ready`, `blocked`, `in-progress`, `done` and `blocked-by-date`.
2. Re-generate the index in the same PR: `python3 docs/tickets/gen-index.py`. CI runs it with `--check` (`tests/in-process/gen-index.test.ts`, in `pnpm test:unit`), so a stale index or a status that disagrees with its blockers fails the PR.
3. After the merge, `.github/workflows/sync-tickets.yml` updates the GitHub issues on the push to `main`; `pnpm sync:tickets` does the same by hand.
