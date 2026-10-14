# Recipes

Entry points per source, with the GitHub CLI. Paste the matching section into each fan-out
subagent's brief.

## Issues and their neighbourhood

- `gh issue view <n> --comments` for the description and every comment.
- Linked and sibling items: `gh issue list --search "<feature word> in:title,body"
  --state all`, `gh search issues "<payload field>" --repo <owner>/<repo>`. Include closed
  ones: a closed item often records why an approach was dropped.
- Earlier work on the surface: blame the touched lines (History, below) and read the items
  and PRs those commits name.

## A PR

- `gh pr view <n> --comments`, `gh pr diff <n>`, `gh pr view <n> --json commits`.
- **Review threads, resolved and outdated included** (resolved threads are where
  objections went to die) need GraphQL:
  `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<n>){reviewThreads(first:100){nodes{id isResolved isOutdated path comments(first:50){nodes{databaseId author{login} body}}}}}}}'`.
  The thread `id` is what `resolveReviewThread` takes; a comment's `databaseId` is the
  `<comment-id>` of the REST reply endpoint.
- Reviewers and approvals: `gh pr view <n> --json reviews,latestReviews`.

## Around the PR

- Open PRs on the same files: `gh pr list --state open --json number,files`, or
  `gh pr diff <m> --name-only` per candidate.
- Every PR of the same work: `gh search prs "<ticket id or feature word>" --repo
  <owner>/<repo>`; across repos, `--owner <owner>`.

## Producers, contracts, other repos

- `gh search code "<field or enum value>" --owner <owner>` finds the producing service;
  `gh search commits "<terms>" --owner <owner>` dates a contract change.
- Generated clients can be stale against their source spec: confirm in the producer.

## History

`git log -L <start>,<end>:<path>` or `git blame -L` on the exact lines finds the commit and
PR that introduced a check; read that PR's discussion too. Keep pickaxe searches
(`git log -S`/`-G`) scoped to a path and a recent range: a history-wide walk is slow, and
in a partial clone it fetches objects on demand.

## CI and deploys

- `gh run list --branch <b>`, `gh run view <id> --log-failed`, and the check runs of a
  commit: `gh api repos/<owner>/<repo>/commits/<sha>/check-runs`.
- A squash merge produces a tree no branch run built: the branch's green run tested the
  branch, not the squash.
- "Is commit X live in environment Y": find the artifact (tag, image, bundle) pinned for
  Y in the deploy config, then map it to a commit through its pipeline run or tag.

## Branch state

State which stage each finding sits at: on a branch, merged to the default branch, or
released. Default branches differ per repo: `gh repo view --json defaultBranchRef`.
