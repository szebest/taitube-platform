# Move-only restructure PRs

A folder move reviews in minutes when git can show it as pure renames, and takes hours when
renames, edits and refactors are mixed (files then show at 51-97% similarity and every one
has to be read). So a restructure ships alone and in two commits.

## Before

1. Merge or wait out the open PRs that touch the folders being moved; a move under them
   turns every one into a conflict. Do it in a quiet window and say so.
2. Record the before counts: `git ls-files <dir> | wc -l` per moved folder, and the test
   file and test totals from one full run.
3. List every reference to the old paths: `git grep -n '<old path>'` (configs, scripts,
   CI, docs, tsconfig paths, workspace globs, Dockerfiles).

## Commit 1: the move, nothing else

- `git mv <old> <new>` for whole folders, so every file stays byte-identical. No edit to a
  moved file in this commit, not even an import.
- Check: `git diff -M --summary HEAD~1` prints only `rename ... (100%)` lines;
  `git diff -M --diff-filter=R --name-only HEAD~1 | wc -l` equals the before count;
  `git diff -M --diff-filter=AM HEAD~1` is empty.
- The build may be red after this commit; that is what commit 2 is for.

## Commit 2: the paths the move forces

- Import paths, workspace globs, tsconfig references, CI and script paths, docs links:
  only the edits the move makes necessary. A rename of a symbol, a cleanup or a refactor
  goes in a later PR.
- Regenerate what is generated from paths (lockfile, route trees, indexes); never hand-edit
  generated output.
- Check: `git diff -M --stat HEAD~2` shows the moved files at 100% plus small edits;
  `git grep -n '<old path>'` hits only records that stay as written (merged tickets, past
  reviews), each accounted for.

## Prove it

- After counts equal before counts: the same number of files per folder, the same number of
  test files and tests in a full run.
- The full gate, not a scoped one: a move breaks things far from the moved folder.
- `git log --follow <new path>` reaches the file's old history.

## The PR body

Say it is a move, list the before and after paths, give the counts, and tell the reviewer
how to see it quickly: "commit 1 is pure renames (`git diff -M --summary`), commit 2 is
the path edits". Squash-merging keeps the renames: git detects them in the squashed diff
as long as the files stayed byte-identical or close to it.
