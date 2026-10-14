---
name: comment-discipline
description: >-
  When a code comment earns its place and when to delete it. Use before writing, editing
  or reviewing code in any language, tests, config and shell included.
---

# Comment discipline

Most changes need no comments. The code is the source of truth; a comment is a second,
unverified source that no compiler checks and no test protects. A few comments still earn
their place, and there a missing one costs more than a redundant one anywhere else. What
this repo enforces on top: `references/this-repo.md`.

Before writing a comment, answer both in one sentence:

> 1. What specific wrong change does this line prevent?
> 2. Reading this file cold in six months, would it still be doing work?

If you cannot answer both, skip it. An existing comment that fails question 2 is deleted,
not shortened. If the code needs a comment to be understood, fix the code instead:
rename, extract a function, name the constant, add a type.

## Earned

1. A workaround for something outside this codebase (compiler, runtime, browser, library).
2. A deliberate choice that is not the obvious approach: say what breaks if someone "cleans
   it up".
3. A rule the type system cannot check: units, inclusive or exclusive bounds, what `null`
   means, an invariant, "if you change this you must also change X".
4. Where a magic value comes from, when it matters if it ever changes.
5. A correctness or security trap: why the obvious fix reopens the hole.

```ts
// Must match the visibility timeout in the queue config; a shorter value double-processes.
const LOCK_MS = 30_000;
```

An interface comment (what a caller needs: contract, units, errors) goes on the exported
declaration; an implementation comment explains a non-obvious why inside it. Each fact is
written once, at the tightest scope that holds it.

## Never

| Never write | Why |
| --- | --- |
| `// increment the counter`, `// loop over users` | restates the code |
| `// switched to a map`, `// now also handles null` | narrates a diff nobody can see |
| `// as requested`, `// fixed per review` | a conversation the reader was not in |
| `// implements AC-3`, `// see PLAN.md`, `// see ABC-123` | an internal artefact as the explanation |
| `// ===== SECTION =====`, `// Arrange` | decoration and labels |
| `// this function does X`, `// note that` | filler |
| commented-out code, emoji, `// TODO: as discussed` | noise; git has the old code |

## Numbers and form

Zero comments is the normal result of a change, not a target. At most one per ~50 lines of
new code, never more than the file already has. One line, under ~80 characters, present
tense, above the code; two lines only for a subtle rule or a security trap.

Machine-readable directives (`eslint-disable`, `biome-ignore`, `@ts-expect-error`,
`# noqa`, `//go:generate`, SPDX and generated-file headers) are exempt from the budget:
never delete, reword or count them. A reason carried inside one still follows these rules.

## Final pass, before calling a change done

Re-read every comment you added, skipping the directives, and delete it if:

- a rename, an extracted function or a named constant would remove the need for it
- it describes what the next line does
- it explains a change, a previous version or why something was added
- it mentions the user, the conversation, a plan, ticket, requirement or internal doc
- it labels test structure or restates a test name or assertion
- it runs past two lines and cannot be cut to one
- you cannot name the specific wrong change it prevents

Editing existing code: do not add comments to lines you did not touch; do fix or delete a
comment your change made wrong (a stale comment is worse than none); match the file's
existing density.

## Read further

| Situation | File |
| --- | --- |
| a comment is earned and you want the before/after that settles the wording | `references/writing-comments.md` |
| the full catalogue of banned and suspect shapes, and prose that reads banned but is not | `references/banned-patterns.md` |
| the comment is in a test, a config or infra file, or on a public API | `references/by-file-type.md` |
