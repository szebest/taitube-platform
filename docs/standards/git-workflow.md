# Git Workflow & Pull Request Standards

This document specifies the branching, code review, merge policy, and CI standards for the `video-pipeline` monorepo.

---

## 1. Branch Protection & PR Barrier (Strict Rule)

Direct pushes and direct merges to the `main` branch are strictly blocked by GitHub branch protection rules.

Every feature, ticket, and bug fix MUST adhere to the following workflow:
1. **Branch Naming:** Create a dedicated branch off `main` named `ticket/NN-slug` for tickets (e.g. `ticket/42-threaded-comments`) or `<type>/<slug>` for non-ticket changes (e.g. `docs/modular-docs-refactor`).
2. **Pull Request Requirement:** Submit all changes exclusively through a GitHub Pull Request targeting `main`.
3. **Formal Approval:** The PR must receive at least one formal approval (`APPROVE`) from a reviewing agent or team member before merging.
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

## 3. Implementor-Reviewer Agent Loop

When AI coding agents (or pairs of engineers) work on tasks:
1. **Implementor Agent:**
   - Implements the feature or bug fix on `ticket/NN-slug`.
   - Runs local verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`).
   - Pushes the branch and creates the GitHub Pull Request.
   - Posts the PR URL in the conversation.
2. **Reviewer Agent:**
   - Evaluates the PR against specification, acceptance criteria, and repository standards.
   - Leaves specific line-by-line review comments or summary feedback directly on the PR.
3. **Iterative Resolution:**
   - Both agents remain active throughout the review-fix loop.
   - The implementor pushes fixes addressing comments or replies explaining technical rationale.
4. **Final Approval & Merge:**
   - Once all review feedback is resolved and all CI workflows pass green, the reviewer submits formal PR approval.
   - The PR is squash-merged into `main`.

---

## 4. Ticket Status Synchronization

When working on tracer-bullet tickets:
1. After the PR is successfully squash-merged into `main`:
   - Update `**Status:** done` on the ticket markdown in `docs/tickets/NN-slug.md`.
   - Re-generate ticket index: `python3 docs/tickets/gen-index.py`.
   - Sync ticket state to GitHub Issues: `pnpm sync:tickets` (or push to trigger `.github/workflows/sync-tickets.yml`).
