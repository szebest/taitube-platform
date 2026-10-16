# PR body

Two readers, two halves. The **reviewer half** (Summary, At a glance, How to review this)
decides how fast someone can review the PR. The **repo half** is the repo's live PR
template (`.github/PULL_REQUEST_TEMPLATE.md` or its lowercase twin on the default branch;
read it each time, it changes). Merge the two: keep the template's headings and fill its
slots, put the reviewer half where the template asks for a summary, never append a second
structure beside the template.

## What the reviewer gets, and what they do not

- **Yes**: what changed and why in two to four sentences; the risk in plain words; the
  change size split by kind; where to start, what to read in which order, what to skim and
  why that is safe; the one or two things you want challenged.
- **No**: a commit list (GitHub has a tab for it), a file table that repeats the reading
  order, process notes, anything the diff already says line by line. Test counts and gate
  output only where the repo template asks for evidence, and then the tail of the output,
  not a transcript.

## The change table: measured, never typed

From inside the repo:

```sh
python3 .agents/skills/git-and-pr-conventions/scripts/pr_stats.py
python3 .agents/skills/git-and-pr-conventions/scripts/pr_stats.py <base> <head>
python3 .agents/skills/git-and-pr-conventions/scripts/pr_stats.py <base> <head> --files
```

It diffs `<base>...<head>` (three dots: from the merge-base, so commits that landed on a
moved base never count), defaults to `origin/main` and `HEAD`; a stacked PR passes the
branch below as `<base>`. `--files` lists every file per kind, for building the reading
order; `git diff --numstat <base>...<head> -- <file>` gives one file's `+N/-M`. What counts
as tests, generated, docs or config is the script's `KINDS`; everything else is production
code. Paste the table as printed.

## Skeleton

```markdown
## Summary

<Two to four sentences: the problem in the user's words, what this PR does about it, and
what deliberately stays the same.>

## At a glance

| | |
| --- | --- |
| What | <one line a non-author understands> |
| Why | <the defect or need, with a labelled link to the ticket> |
| Risk | <what could break, for whom, where to look; or "low - <reason>"> |
| Merge danger | <two-way door, or one-way: a migration, a contract, a persisted key> |
| Contracts | <APIs, events, config keys, schemas that change; or "none"> |

<the pr_stats.py table>

## How to review this

**Start with** `<path>` - <the decision the PR hangs on and what to check in it>.

**Then, in order:**

1. `<path>` (+N/-M) - <what it decides; the function or branch worth a look>
2. `<path>` (+N/-M) - <...>

**Skim:** <the mechanical part: renames, moves, generated output> - <why it is safe and how
to see it quickly, e.g. "pure moves, `git diff -M` shows R100">.

**Tests:** <which spec covers which behaviour, one line each; deleted specs and why>.

**Push on:** <the one or two questions you want a reviewer to challenge>.
```

## Rules

- **Size the body to the PR.** A small change (no design decision, a few files) gets the
  Summary, the change table and the template. "How to review this" is for anything a
  reviewer has to think about; on a big PR, group the reading order under bold area
  labels.
- **No placeholder survives**: a template comment left unfilled, `TODO`, `<...>`. A
  template section that does not apply gets one line saying so, never an empty heading.
- **Testing steps** any tester can follow without asking: the setup, the input, what to
  look for. Never your own throwaway data.
- **A contract change** gets a field table with a behaviour column: per field, what
  changed and whether it works the same or differently.
- **A commit-by-commit PR** says so in How to review this, with what each commit holds.
- **A stack** (`stacked-prs.md`): the feature PR's body is the stack's index. Its Summary
  says it is the branch the slices squash into, a draft until they are in, needing no
  full review afterwards (check it last); then the slicing plan as a table (slice, PR,
  what it holds, the criteria it proves, lines), and, once the last slice is in, the
  evidence for the whole ticket with every slice together. Each slice's Summary opens
  with "Slice b of 3 of ticket NN, on #M (slice a)" and says what the slices above it
  will do, so nobody asks for that here; its change table uses the branch below as
  `<base>`.
- **Rewrite in place** when the branch changes, keeping what anyone else added by hand
  (images, notes).
