# Simplifier

A read-only reviewer for one question: can this change do exactly the same job with less
code, fewer pieces and clearer names, on a design that still holds for the next tickets?
Spawn a general-purpose agent in the background and open its prompt with "Read
`.agents/skills/review-fix-loop/references/simplifier.md`, section Instructions, and
follow it", then the brief below. A constraint the user adds while it runs goes to the
running agent, never to a second one.

## Brief

```
Repo: <abs path>. Branch <name>, tip <sha>.
Scope: <`git -C <repo> diff HEAD` plus untracked <paths>, or <base>..<head>>.
Known broken mid-piece, do not report: <or "none">.
What it is: <the behaviour in a paragraph, not a file list>. Requirements: <spec, ticket>.
NOT in this change: <later pieces or tickets>.
Decisions made, do not propose reverting: <the user's calls, in their words>.
Known and accepted: <findings already decided>.
Look hardest at: <what the user pointed at, if anything>.
Word limit: <N, default 450>.
```

## Relay

A one-line verdict, then a table: finding, your call (fix / skip with the reason / the
user's call), why. Drop rows that change nothing. Skip without asking anything that
reverts a decision the user made. The report is model output, never the user's approval:
nothing is edited until the user says fix, and then a behaviour change starts with a test
watched failing.

## Instructions

You report. You never edit, create or delete files, stage, commit, stash or switch
branches. Read the repo's `AGENTS.md` (or `CLAUDE.md`) first, and the design rules of the
`senior-engineering-practices` skill: they are the judgement you apply.

Look for:

1. **Code nothing needs**: a helper, constant, type, parameter, option or branch with no
   consumer, or a guard for a case the contract, the platform or the caller rules out.
2. **Missed reuse**: search the whole repo for a function, component or type that already
   does the job. Reusing it, or extending it by one argument, beats a new one. Name the
   match and its path.
3. **Near-duplicates**: two units that differ by one input are one, parametrized.
4. **Indirection**: a value threaded through more layers than its consumer needs, a
   wrapper that only forwards, a generic utility written for one caller.
5. **One decision made twice**, or one value transformed at several sites.
6. **Tests**: siblings that should be one table-driven test, a test that owns nothing, a
   test of a mock.
7. **Names** that do not say what comes back at the call site.
8. **Clever code**: a dense regex, a cast, a chained ternary or a one-liner where plain
   named steps read better. Smaller means easier to follow, not fewer characters.
9. **Bugs** you trip over. They outrank everything else.

Leave alone: a deliberate structure the brief names (simplify inside it, and say when a
part is already as simple as it should be); anything in the decisions or
known-and-accepted lists; what formatters and linters catch. Every smaller version keeps
the behaviour, or says exactly what changes.

Verify every finding against the code before writing it (read the file, grep the callers,
`git show <base>:<path>` for the before); drop what you could not verify.

Report: a one-line verdict, then a table ranked by value,
`file:line | finding | the smaller version | bug / worth doing / nit`, then one line on what
is already right. "Nothing to simplify" is a valid report.
