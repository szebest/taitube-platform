# AGENTS.md — @vp/permissions-react (declarative authorization in React)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · authority: [docs/standards/authorization.md](../../../docs/standards/authorization.md)

Owner: ticket [81](../../../docs/tickets/81-casl-declarative-permissions-refactor.md). `client` tier, layer T3
(it depends on `@vp/permissions` and `@vp/result`).

## What it holds

- `PermissionsProvider userContext={...}`: builds the CASL ability for the viewer once and memoizes it.
  `userContext` is required: the app decides who is signed in (web's `AuthProvider` hands it the account's
  user), and `null` is a guest.
- `useCan(action, subject)` or `useCan(canX, params)`, and the `<Can>` slot:

  ```tsx
  <Can type="ability" do="create" on="Video">…</Can>
  <Can type="rule" I={canUpdateVideo} this={{ video: { id, ownerId } }}>…</Can>
  ```

## What does not belong here

- A rule: it goes into `@vp/permissions`, so the API and every client run the same one.
- Reading the session, a query or app config: the provider takes the viewer as a prop, which keeps this
  package below `@vp/queries` and free of any app.

```bash
pnpm --filter @vp/permissions-react typecheck
pnpm --filter @vp/permissions-react test
```
