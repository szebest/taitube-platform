# AGENTS.md - @vp/components (the shared components)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [95](../../../docs/tickets/95-design-system-2.md), section 6. `client` tier, layer T4: above `@vp/ui` (T3),
whose primitives it composes, and below the apps. Specs: [docs/design/components/](../../../docs/design/components/README.md).

## What it holds

Only what web and studio both render today. A piece moves here from an app kit the day the second app needs it,
never earlier.

- `PageHeader`, `EmptyState`, `ErrorState`, `SectionError`, and the skeleton of each that has one.
- The eight state illustrations (`src/illustrations/`), plain SVG components drawn in `currentColor`: the parent's CSS
  colour tints them, so they take `accent` per theme.
- The presentational parts of the sign-in card and the account menu; the session hooks stay in `@vp/queries`.

Every component is a folder, `src/<area>/<name>/`, shaped like a `@vp/ui` primitive: `<name>.tsx`,
`<name>.context.ts` and `<name>.variants.ts` for a compound one, `types.ts`, a story and a jsdom spec. It reads the
words it prints itself through `useUiCopy()` and takes product words as children.

## What does not belong here

- A component one app alone renders: it goes in that app's kit (`apps/client/<app>/src/components/`).
- A data hook, the router or the API client: a smart wrapper in the app owns them.

```bash
pnpm --filter @vp/components typecheck
pnpm --filter @vp/components test
```
