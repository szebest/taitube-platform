---
name: work-ticket
description: >-
  Delivering one ticket end to end as a vertical slice: claim it, load only the context it
  links, build test-first, prove every acceptance criterion, open the PR, hand it over for
  review. Use when asked to work on, implement or do a ticket.
license: MIT
metadata:
  pairs-with: tdd, code-review, verification-before-completion
---

# Work a ticket

A ticket is a tracer bullet: a thin vertical slice through every layer it touches, shipped
in one PR. This repo's tickets, index, gates and non-negotiables:
`references/this-repo.md`.

## 1. Claim

1. Confirm the ticket is unblocked: every ticket it is blocked by is done, read from the
   ticket files on a freshly pulled default branch, never from memory or an index alone. A
   missing blocker stops the work; say which.
2. Branch from the default branch, mark the ticket in progress the way the repo does, and
   commit that as the first commit.

## 2. Load the context the ticket links, and nothing else

- Read the ticket whole, then only the sections of the requirements and design docs it
  links: the links are the context budget.
- Use the glossary's words for names and test titles.
- A contract the ticket touches (a payload, a schema, an environment key, a table) changes
  together with its design doc in the same PR, or not at all.
- Version numbers in a ticket are stale text, not pins: a new dependency starts on its
  current major.

## 3. Build the slice

- Vertical: schema, package, app, test and docs in one branch; never "tests later".
  Test-first at agreed seams (`tdd`), under `test-discipline`.
- Every acceptance criterion becomes a test, or, where it is a manual demo (playback, a
  dashboard, an autoscaling graph), a recorded artifact committed where the ticket says.
- Design judgement: `senior-engineering-practices`. A decision the ticket does not cover:
  pick the option most consistent with the design doc's decisions, record it in the ticket
  as decided, and flag it in the PR.
- Open the PR on the first push, as a draft (`git-and-pr-conventions`), and push after
  every commit.

## 4. Prove it

Run the repo's full gate fresh and keep the tail of each output
(`verification-before-completion`). Walk the acceptance criteria one by one and tick each
with its evidence: a test name, a command output, an artifact path.

## 5. Hand over

- Mark the ticket done and regenerate whatever index the repo derives from ticket status, in
  the same PR.
- The PR body carries the criteria with their evidence, the decisions made and the docs
  updated; the review happens on the PR (`review-fix-loop`, or the GitHub mechanics in
  `git-and-pr-conventions`).
- Merging belongs to whoever owns the default branch's approval: hand over the PR and the
  exact merge command, never merge around a required review.
