# Duplication catalogue

Recurring shapes of test slop, and what replaces each.

1. **The same behaviour asserted at three layers**: the unit's spec, the spec of the
   component using it, and a second consumer's spec. Budget: one unit-level test plus one
   integration test per consumer.
2. **A loop over a dimension the code does not branch on**: toggling a menu at eight
   positions proves the toggle eight times and the positioning zero times. The position
   logic gets its own table in the pure helper's spec.
3. **A focused test restating the tail of a kitchen-sink test**: replace the kitchen sink,
   or do not add the focused one.
4. **Two tests for the two sides of one guard**: fold them into a table; if the surviving
   table lost an assertion, add a column, so coverage only grows.
5. **Assertions that cannot fail for a reason that matters**: listener call counts, table
   rows for an alias that only exercise `===`, a distinctness check over renders that still
   passes when two branches are swapped. Delete them. The real version asserts the
   observable consequence (a timer that restarts fires late; assert the late fire).

When cutting a slop test drops coverage, that is information, not debt: check what lost
coverage and assert that behaviour once, directly.
