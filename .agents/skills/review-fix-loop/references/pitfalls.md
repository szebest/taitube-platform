# Pitfalls seen in real loops

Each line is something that went wrong or nearly did, and what to do instead.

## Reviewers

- **A reviewer left on the local checkout reviews the wrong branch.** Pass the PR number
  or the ref; review skills default to whatever is checked out.
- **Call arguments versus pass-through.** Asserting the arguments the code computes for a
  dependency is the right test; a test proving only that a value passed through unchanged
  owns nothing. Do not let a reviewer conflate the two (`test-discipline`).
- **Removed tests leave setup behind** (constants, spy wrappers, hoisted mocks): remove it
  in the same fix, or the next round reports the leftovers.
- **A reviewer asks for a convention the repo has deliberately dropped.** The repo's
  documented rule wins; record the skip where the next reader looks (plan, PR body).

## Fixes

- **A moved or renamed unit is rewritten, not carried verbatim**, and the rewrite reads
  line by line: no dense regex, cast or one-liner standing in for plain steps.
- **Runtime imports of test globals survive renames**: every touched spec drops them in
  the same fix when the runner injects globals.

## Git

- **One file, two commits.** Pre-commit tools that stash unstaged hunks cannot restore a
  half-staged file. Stage a hand-built version instead (`git hash-object -w` plus
  `git update-index --cacheinfo`), or swap the file on disk to the commit's version,
  commit, restore, and compare with `cmp`.
- **Cherry-picking reordered slices** conflicts where a later commit touched lines an
  earlier one moved: resolve to "the reviewed content plus the intended differences", then
  prove it with `git diff <backup> <last-slice> --stat`.

## Measuring

Build the base from `git archive <merge-base>` in a scratch directory, never from a moving
`origin/main`. Build output directories keep stale chunks between builds: snapshot right
after each build.
