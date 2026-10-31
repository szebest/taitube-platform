# AGENTS.md - @vp/components (the shared components)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [95](../../../docs/tickets/95-design-system-2.md), section 6. `client` tier, layer T4: above `@vp/ui` (T3),
whose primitives it composes, and below the apps. Specs: [docs/design/components/](../../../docs/design/components/README.md).

## What it holds

Only what web and studio both render today. A piece moves here from an app kit the day the second app needs it,
never earlier.

- `PageHeader`, `VideoThumbnail` (the frame with duration, progress and badges that web's cards and studio's
  library rows both draw), `EmptyState`, `ErrorState`, `SectionError`, and the skeleton of each
  that has one.
- `Shelf`, `VideoCard` and `StartHereShelf` (a headed scroller of cards, the one video card, and the channel's Start here shelf), which web's pages draw and the studio's Start here section previews.
- The eight state illustrations (`src/illustrations/`), plain SVG components drawn in `currentColor`: the parent's CSS
  colour tints them, so they take `accent` per theme.
- `LoginCard` and `AccountMenu`, the presentational parts of sign-in and the account menu; the session hooks
  (`useAccount`, `signOut`) stay in `@vp/queries` and each app wraps them in `features/auth/components/`.

Every component is a folder, `src/<area>/<name>/`, shaped like a `@vp/ui` primitive: `<name>.tsx`,
`<name>.context.ts` and `<name>.variants.ts` for a compound one, `types.ts`, a story and a jsdom spec. It reads the
words it prints itself through `useUiCopy()` and takes product words as children.

Every component is imported by both apps (`tests/architecture/shared-components-used-by-both-apps.test.ts`). How to
add one: [docs/standards/design-system.md](../../../docs/standards/design-system.md).

## What does not belong here

- A component one app alone renders: it goes in that app's kit (`apps/client/<app>/src/components/`).
- A data hook, the router or the API client: a smart wrapper in the app owns them.

```bash
pnpm --filter @vp/components typecheck
pnpm --filter @vp/components test
```
