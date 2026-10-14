---
name: senior-engineering-practices
description: >-
  Design judgement for production code: question the inputs, look ahead, ask before
  hard-to-reverse decisions, decide where code belongs, unify and reuse before writing,
  the simplest mechanism, the whole-file pass before done. Use before designing a change,
  following a plan or writing production code, and before calling it done.
---

# Senior engineering practices

The repo's own architecture docs own the structure; this is the review judgement on top.
Where this repo puts things: `references/this-repo.md`. Vocabulary for module depth and
seams: the `codebase-design` skill.

## 1. Before designing: read what was decided, then question it

- **Read the decisions first.** For risky or unfamiliar code, grep the design docs, plans
  and closed tickets for every field, type and file name in the change. Plans hold
  decisions that never reached the code: what a name means, who owns a contract, which
  ticket is mid-flight on the surface.
- **A sibling ticket owns the flag, key, contract or surface**: say so before changing it;
  if it lands first, merge its change in, never re-implement it.
- **Inputs are not the truth.** The ticket, spec, plan, the user's own instruction and the
  premise of any rule were written by people or agents and can repeat the mistake that
  produced them. Verify every claim (a fact, a number, "X already does Y") before building
  on it; raise one that looks wrong, follow right ones without comment. A rule applied for
  an effect (bundle size, speed, a cache) gets its premise checked in this code first.
- **Look ahead**: pick the design the next known additions extend (a row, an argument, a
  new implementation of an existing interface), not one they rewrite. Name any debt a
  shortcut leaves and the ticket that pays it.
- **Routine choices are yours** (names, file split inside a feature, test shape): decide,
  record the reason in the plan, never ask.
- **High-impact or hard-to-reverse decisions are asked before the code**, even when you
  are fairly sure: a confirmed call costs a minute, a wrong one a rewrite. The test, the
  ask format and what to do after: `references/decisions.md`, read before any such
  decision.

## 2. Designing: who owns it

- **Business logic goes where every consumer can use it**, behind the layer the repo
  defines for it. A view or handler renders and binds; logic in it means placement was
  skipped.
- **Decide once, in the owner, and hand facts down**: `isLocked`, a formatted label,
  `null` for not applicable. Consumers never re-derive, and no decision has two
  predicates.
- **Put behaviour where it happens**, never lifted to a parent to thread its result
  through arguments.
- **Platform, environment and tenant variance goes behind an injected interface or a data
  map**, never an `if` in shared code.
- **State lives at the lowest level that fits**, and server data is never mirrored into a
  second store.

## 3. Designing: unify and reuse before writing

- **A new case is a row, argument or implementation on the existing owner.** Duplication
  needs a written reason, unification none. The second copy is the moment.
- **Before any new function, component, type or constant**, search the whole repo for name
  variants, the key call (endpoint, query, store key, formatter) and the value produced; a
  match in an unrelated feature counts. Then, in order:
  1. **Reuse** it if it sits in a layer you can import.
  2. **Extract** it if it lives in another feature: move it to the shared layer, named for
     the value, and repoint the original caller in the same change.
  3. **Generalise** it if the gap is small (an argument, a map row, callers' behaviour
     kept). Needing a mode flag or a forked body means the abstraction is wrong: write a
     new one and say why.

  Never copy and tweak. The reply names every near-match and its fate.
- **Moving one sibling consumer to a new owner moves them all.**
- **Shared layers hold only generic code named for the value**, never a feature name.

## 4. Designing: the simplest mechanism

- Fewest files, helpers and types, then simplify again. The naive version first,
  structure only for a failure you can name; a presented design says what the simpler
  version was and why it fails.
- **Simple means readable, not compact**: plain named steps over a dense regex, a cast, a
  chained ternary or a clever one-liner. Moved or renamed code is rewritten to the smallest
  thing its callers need, never carried verbatim.
- **The name already is the value**: no synthetic ids, counters or rebuilt tokens when the
  thing in hand identifies itself.
- **Configure the library before wrapping it**; reach for the platform (`Intl`, `URL`,
  `AbortController`) before a dependency.
- **A real language gets its real parser** (SQL, YAML, a query language, a subtitle
  format), never a stack of regexes. When the text is your own output, assert on the text.
- **A union of shapes carries one literal discriminant**, switched on exhaustively, never
  told apart by probing for a key.
- **Per-type behaviour is a registry typed from the source tuple**, so the compiler forces
  every case.
- No extension point without a consumer, no unused option; a flag is judged by what it
  protects that a gate does not.
- **A bug that is a class** (a race, a stacking context, a contract the producer never
  sends) is fixed where every consumer benefits; say so.
- **A rule that slipped gets a machine check**, not louder prose: a lint rule or an
  architecture test with a fixture proving it fires.
- **Production cost**: dev-only tooling is never loaded in production; a new dependency
  starts on its current major (read the migration guide of every major crossed, no compat
  shim) and quotes its size when it ships to a browser. A major several open PRs touch is
  bumped by one owner.

Code shapes for these: `references/patterns.md`, read before writing one.

## 5. Writing the code

- **No thin wrappers**: a one-call module is deleted, a one-field helper is inlined; extract
  only what decides something several callers share. A single-consumer helper stays in
  its consumer's file.
- **One source of truth for a value**: a named variable, passed raw to every consumer,
  never transformed per site. What can be computed from data you already hold is derived,
  never stored beside it.
- Names describe content, not shape; types come from the platform or the generated
  contract, never re-declared by hand.
- Tests: `test-discipline` and `tdd`. Comments: `comment-discipline`.

## 6. Before calling it done

- **Read the whole file you touched**, and its spec, not only the diff, and clean up their
  antipatterns in the same change: needless projections (a field mapped one-to-one into a
  new shape, an alias of a contract type), sibling fields handled two ways, thin
  single-use wrappers, repetition (tests into one table, a repeated conditional into a
  map, a recomputed value into one variable), unions told apart by probing. Dead code and
  exports the change itself leaves behind are removed, not reported. The reply names what
  was folded, and what was left and why.
- **Where the pass stops**: inside the touched file and its spec. Ticket work cleans up; a
  pointed edit (the request names the change) changes exactly that and lists its other
  findings in one line. Generated files and lockfiles are read only where you touch them.
- **Two limits:**
  - code a named follow-up ticket rewrites or deletes is left alone; report what you saw;
  - contract fields, exported types and assertions the change does not own stay, even
    when nothing reads them; report them as possibly dead.
- Answer the review questions on your diff, in the reply: what did I add that nothing
  needs? What does the same job twice, counting code outside the diff? Which decision is
  made twice? Which test owns nothing? What is the smaller design?
