# 69: Frontend URL-driven state architecture — search params sync, modal deep-linking (STS pattern) & typesafe routing

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#69](https://github.com/szebest/taitube-platform/issues/69) |
| Size | M |
| Blocked by | 55 - Modern design system foundation · 89 - TanStack Start foundation |
| Blocks | 73 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

Every route already has a Zod `validateSearch` from [89](89-web-tanstack-start-foundation.md). This ticket adds
URL-driven modals on top of it: a dialog that Back closes, that survives a reload and that can be shared as a
link. Route search keys for search, studio and settings belong to
[74](74-frontend-multi-resource-search-discovery-ui.md), [60](60-creator-studio-dashboard-video-management-ui.md)
and [72](72-frontend-settings-customization-system.md).

## What to build

1. **Modal search fragment.** A registry of modal ids in `apps/web/src/features/url-modal/`, each with its own
   Zod params schema, composed into a reusable search schema fragment that a route merges into its
   `validateSearch`. The `modal` key is one literal discriminant; its params are typed from the registry.
2. **`useUrlModal(id)`** returning `{ isOpen, params, open(params), close() }`. Opening pushes a history
   entry; closing navigates back when the modal was opened in this session and otherwise replaces, and it
   removes the modal's own keys from the URL.
3. **`<UrlModal id>`** in `apps/web/src/components/ui/url-modal.tsx`, a Radix Dialog whose `open` is bound to
   the hook, so Escape, backdrop and the close button all go through `close()`.
4. **Push vs replace discipline.** Modals push; filters, tabs and chips replace. Documented in
   `apps/web/AGENTS.md` next to the route conventions.
5. **Search retention.** Router search middleware so the modal keys and other shared keys survive or drop
   predictably across `Link`s, instead of each link spreading `prev`.

The feature tickets register their own modals (share in 59, save to playlist in 73, settings overlay in 72,
auth in 56). This ticket proves the mechanism with a spec route.

## Acceptance criteria

- [ ] Opening a modal pushes a history entry; Back closes it without reloading the page underneath.
- [ ] Escape, backdrop click and the close button remove the modal and its params from the URL.
- [ ] Loading a URL with `modal=<id>` renders the page with that modal open, on the server render too.
- [ ] An unknown modal id or invalid params are dropped by `validateSearch`, not rendered.
- [ ] `useUrlModal('x')` does not compile for an id missing from the registry, and its `params` type comes
      from that modal's schema.
- [ ] Changing a filter or tab uses `replace`; opening a modal does not.

## Out of scope

- Moving any existing dialog to the URL; the feature tickets do that when they register their modal.
- Persisting URL state in browser storage.

## Testing plan

- Integration specs over memory history (the `renderRoute` helper from [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md) once it exists): open, back, deep link, invalid id.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint` green.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
