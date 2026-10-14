# Working with the maintainer

How to read a request, when to ask, how to report, and whose name goes on the work. The test for a
high-impact question and its format are `senior-engineering-practices`.

## Reading a request

- **A step the outcome needs is part of the request**: commit before push, push before the PR, regenerate
  the ticket index, update the doc the change makes stale. Before ending on a question, check whether the
  request already answered it; if it did, act.
- **A yes covers the tail.** "Fix it, then open the PR" approves the whole chain. Stop only for a deviation
  that changes behaviour or a contract.
- **Short instructions are literal.** "Do nothing else" means no PR and no extras.
- **Which choices to make and which to ask about**: `senior-engineering-practices`, section 1.
- **A verify request is read-only** ("check", "verify", "is this right"), even after the verdict lands well:
  the verdict-only branch of `review-fix-loop`. An ambiguous follow-up gets one question about what to change.
- **Scope moves.** When redirected mid-task, recheck what is live before continuing.

## Facts

- **Measured beats written.** Ground a claim in what you checked today (source, a command, a live
  response), never in a doc or a note alone. This repo's docs have described an intended system ahead of
  the code before, so verify a claim against source before building on it.
- **On a correction, check the data**, then say plainly what it shows, including when it supports the
  maintainer only in part.

## Workspace

- **Your commits, your work**: someone else's uncommitted changes stay as they are (`review-fix-loop`,
  section 1; worktrees in `git-and-pr-conventions`, `references/worktrees.md`).
- **Fast path.** Run the narrowest gate that proves the edit (`pnpm --filter <pkg> test`, one spec) while
  iterating; the full gates run once, before the PR.

## Reports

- The outcome goes once, at the top, with the link when there is one.
- Lists over prose: facts, gaps and risks one line each; one recommendation, not a survey; a table only with
  the rows that change something.
- A choice that hinges on code shape shows the options as fenced code.
- The report ends on its last fact.

## Credit and voice

- No AI or tool attribution anywhere: `git-and-pr-conventions`.
- Prose that leaves under the maintainer's name is in the maintainer's voice: `prose-conventions`.
