---
name: test-discipline
description: >-
  Rules for any spec: the table-test gate, one named setup helper, mocks that are never the
  thing under test, the sweep before done. Use before the first test line or mock, when
  reviewing a spec, and before calling a test-heavy change done.
---

# Test discipline

Read every test diff asking "do we need all of these, or is some of it slop": the answer
must already be no. The default is fewer tests: a test, and an assertion added to one, has
to earn its place through the gate below. Red before green, seams and tautological
assertions are the `tdd` skill; runner syntax is `vitest-testing`. This repo's layers,
harnesses and machine checks: `references/this-repo.md`.

## Hard rules

1. **Appending a sibling test is the defect.** Tests that differ only by input are one
   table test (`it.each`), existing ones included, in the same change.
2. **Every spec builds its subject through one named helper** at the top of the file, even
   a one-test spec: defaults plus the overrides a test varies.
   `const renderCard = (props: Partial<CardProps> = {}) => render(<Card {...defaults}
   {...props} />)`. A test body never assembles the subject inline.
3. **Never test a mock.** A mock is a plain function returning a static shape; the test
   asserts the arguments the code computed for it, never a value only the mock produced.
   A mocked module's behaviour is tested in its own spec. Read `references/mocks.md`
   before writing any mock.
4. **No runtime imports of test globals** when the runner injects them (`describe`, `it`,
   `expect`, `vi`); a type-only import stays. Every spec the change touches drops its old
   import, a rename included.
5. **A refactor adds no tests** and keeps the suite green (a behaviour change goes red
   first, `tdd`). Never test a behaviour another ticket is about to change, and never pin
   wrong behaviour because it is the current one.

Also never: a test that only holds a coverage number; a change detector (a constant
asserted equal to its own value, exact copy the code does not branch on); listener or call
counts that cannot fail for a reason that matters; children stubbed only to check the
props they got (pass-through proves nothing). Removing a test the change owns removes the
setup it leaves behind; a test the change does not own is reported as possibly dead, never
deleted.

## The table gate: answer it in the reply

Before writing, changing or reviewing a test, or adding an assertion to one:

1. Should it exist at all? No when:
   - another spec already covers it, a broader one included: a shared helper's own spec
     owns its guard, so a caller's spec does not re-check it;
   - the state cannot happen in the running system;
   - the assertion cannot fail (it checks for something the code path never produces);
   - it is low value: no user, tester or downstream consumer would notice it breaking.

   A pure function's rules belong in its spec, not re-asserted at component or
   integration level.
2. Do any tests, existing plus new, differ only by input? Fold them into one table; this
   beats matching the file's existing copy-paste shape.
3. Is there an existing table this belongs in as a row?
4. Does the test assert something the code actually branches on? A copy with an id
   renamed asserts nothing.
5. Are the neighbours due a fold? In a spec you already touch, folding repeated setup into
   the helper and fixing test names is in scope; a spec you do not touch is reported.

Mechanics: a leading label column names the rows; array rows print with `%s`, object rows
with `$prop` (mixing them prints identical names: run with a verbose reporter once); rows
cover each branch plus every value a predicate hard-codes; the setup helper takes the
overrides the rows vary; a repeated payload literal becomes a builder with a spreadable
default. Folding keeps every assertion: split the table rather than drop a check.

## Before "done": one sweep over the whole test diff

List every test name in the diff and name the one thing each owns that nothing else does;
no answer means delete. Scan every mock in each touched spec: an implementation mock or a
branching mock is fixed in the same change, never "pre-existing". Re-run and compare the
pass counts. Recurring shapes: `references/duplication-catalogue.md`.
