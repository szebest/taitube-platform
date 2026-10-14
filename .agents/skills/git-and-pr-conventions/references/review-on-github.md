# A review loop on GitHub

When review happens on the PR itself, so the history of every finding and its fix stays on
the PR. Who decides what to fix is `review-fix-loop`, Triage; this is the GitHub mechanics.

## A round

1. A fresh reviewer per round reads the exact range (`git diff <merge-base>..<head>`),
   runs the gate and checks CI on the head.
2. It posts **one review** per round, not a stream of single comments: blockers, majors
   and the two or three minors worth discussing as inline comments, each anchored on a
   line inside the diff; the round number and a one-line verdict in the summary. Nits go
   to whoever triages, not onto the PR.
3. The review event is `COMMENT` when the reviewer posts as the PR's author: GitHub never
   lets an author approve or request changes on their own PR.

```sh
gh api repos/<owner>/<repo>/pulls/<n>/reviews --method POST --input review.json
```

with `review.json` holding `commit_id`, `event`, `body` and `comments` (each with `path`,
`line`, `side: "RIGHT"` and `body`).

## Fixing

- Every finding is fixed, pushed back on with the reason and evidence, or deferred to a
  named owner. All three get a reply in the finding's thread, never a new top-level
  comment.
- A fix reply names the commit: `fixed in <sha>`, then the thread is resolved. A
  push-back stays open for the reviewer to answer.
- Nits that were fixed get one summary comment listing them.
- The next round starts on what is already pushed; nobody waits for an "all done".

```sh
gh api repos/<owner>/<repo>/pulls/<n>/comments/<comment-id>/replies -f body='fixed in <sha>'
gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<thread-id>"}){thread{isResolved}}}'
```

The thread `id` and each comment's `databaseId` (the `<comment-id>` above) come from the
`reviewThreads` query in `full-picture`, `references/recipes.md`.

## The next round

Round 2 and later review the delta since the last round plus the threads still open, and
mark each earlier finding addressed or not. A resolved thread is reopened only with new
evidence.

## Clean

A round with no blocker or major, every thread replied to, CI green on the head, and the
branch up to date with its base.
