# AGENTS.md — @kit/forms (TanStack Form set-up)

> Tier rules for this directory: [../AGENTS.md](../../../client/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

Owner: ticket [53](../../../../docs/tickets/53-frontend-architecture-modernization-tanstack-query.md). `client` tier,
a layer above `@kit/ui`, whose primitives its fields render.

## What it holds

- `useAppForm`, which binds `TextField`, `SelectField` and `FileField` to `form.AppField`. A field reads its
  error once it is touched (`fieldError`).
- `validateWith(rule)`: a field validator over an input rule that returns a `Result` with a `@kit/errors`
  failure, so the browser runs the check the API runs, answering the failure's message or nothing.

The fields render `@kit/ui`'s `Field`, `Input`, `Textarea` and `Select` and nothing else: no CSS module. `FileField` styles its dropzone with token classes, which each app's stylesheet scans through its
`@source` list. `FileField` takes its words as props (`placeholderText`, `selectedText`).

## What does not belong here

- A field validator for one entity (`video-field-validators`): it lives with the app feature that edits it.
- A rule: it goes into the app's rules package, built on `@kit/validation`.
- A submit flow, a mutation or a toast: the page owns them.

```bash
pnpm --filter @kit/forms typecheck
pnpm --filter @kit/forms test
```
