# AGENTS.md — @vp/forms (TanStack Form set-up)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [53](../../../docs/tickets/53-frontend-architecture-modernization-tanstack-query.md). `client` tier,
layer T4: above `@vp/ui` (T3), so its fields can move onto the design system's primitives when the legacy
Bootstrap form goes.

## What it holds

- `useAppForm`, which binds `TextField`, `SelectField` and `FileField` to `form.AppField`. A field reads its
  error once it is touched (`fieldError`).
- `validateWith(rule)`: a field validator over a `@vp/validation` rule, so the browser runs the check the API
  runs, answering the failure's message or nothing.

The fields render `react-bootstrap` controls today, and `FileField` styles its dropzone with the legacy
`--grayscale-*` variables an app's global Bootstrap theme defines.

## What does not belong here

- A field validator for one entity (`video-field-validators`): it lives with the app feature that edits it.
- A rule: it goes into `@vp/validation` or `@vp/domain-rules`.
- A submit flow, a mutation or a toast: the page owns them.

```bash
pnpm --filter @vp/forms typecheck
pnpm --filter @vp/forms test
```
