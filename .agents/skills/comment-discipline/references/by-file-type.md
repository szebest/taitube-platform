# Tests, config and public APIs

The two questions, the budget and the final pass work the same everywhere. What changes is
where bad comments tend to show up.

## Tests

- No `// Arrange`, `// Act`, `// Assert`, `// Given/When/Then` or `// setup`: a blank line
  between the phases is enough.
- No comment restating the test name or the assertion. Put the words in the test name: the
  runner prints it on failure.
- A test earns a comment when a fixture or stub looks wrong but is right for a reason
  nobody would guess.

```ts
// The menu stays hidden until IntersectionObserver fires, and jsdom ships none.
stubIntersectionObserver({ isIntersecting: true });
```

## Config, infra and other non-code files

YAML, Dockerfiles, Terraform, CI workflows, shell and SQL follow the same rules:
`# install dependencies` above `RUN pnpm install` is the same bad comment as
`// increment the counter`. These files earn more comments than most, because the reason
behind a line is often unguessable: a pinned version that breaks when bumped, an order
that must not change, a value with a twin in another system, a flag that works around a
provider bug. Comment those, nothing else.

```yaml
# 300s: cold starts on the shared runner exceed the 120s default.
timeout: 300
```

## Public APIs and docstrings

An exported library API, or code with a doc generator, is the exception: its users cannot
read the implementation. Document only the non-obvious contract (units, ownership, errors,
concurrency, edge cases), never the signature. No docstrings on private helpers for
completeness. Free text inside a doc block follows every rule here. If a linter requires a
doc comment, write the shortest honest one.

## Framework code

- Do not explain a dependency array, a memo or a re-render; if the code needs that, the
  code is the problem.
- Do not explain a type narrowing the type already states.
- A `@ts-expect-error` or a lint suppression carries a one-line reason.
