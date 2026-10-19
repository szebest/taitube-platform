# EmptyState

One editorial line and one action, for any place that has nothing yet. Every surface designs it before it ships. In `@vp/components` because both apps render it.

## Anatomy

```
              1 illustration (optional, 180 px, accent)

           2 Nothing queued yet
           3 Save a video from anywhere and it will wait here, in the
             order you chose.

                   [ 4 Browse videos ]   5 Learn how queues work
```

| # | Region | Notes |
|---|---|---|
| 1 | Illustration | a line illustration in `accent`, 180 px, `aria-hidden`; none at `size="inline"` |
| 2 | Title | `title-lg`; the one editorial line, a sentence in the serif (`editorial`) when `titleStyle="editorial"` |
| 3 | Description | `body`, `fg-muted`, at most two lines, 520 px maximum width |
| 4 | Primary action | one `Button`; the only action that matters |
| 5 | Secondary | an optional text link, never a second button |

## Props

Plus the standard props. The title is the heading element the caller passes.

```ts
// types.ts
import type { TypeStyleOption } from '@vp/design-tokens';

export type EmptyStateSize = 'page' | 'section' | 'inline';
export type EmptyStateTitleStyle = Extract<TypeStyleOption, 'title-lg' | 'editorial'>;
```

```ts
interface EmptyStateRootProps {
  size?: EmptyStateSize;             // default 'page'
  titleStyle?: EmptyStateTitleStyle; // default 'title-lg'; 'editorial' sets the title in the serif for curated surfaces
}
// Parts: EmptyState.Root, .Illustration, .Title, .Description, .Action, .Secondary
```

```tsx
<EmptyState.Root size="section">
  <EmptyState.Illustration><Tapes /></EmptyState.Illustration>
  <EmptyState.Title><h2>Nothing queued yet</h2></EmptyState.Title>
  <EmptyState.Description>Save a video from anywhere and it will wait here, in the order you chose.</EmptyState.Description>
  <EmptyState.Action asChild><Link to="/">Browse videos</Link></EmptyState.Action>
</EmptyState.Root>
```

`EmptyState.Action` is the one primary action; a secondary text link is `EmptyState.Secondary`, never a second button. The announce-once `role="status"` is applied when the state mounts after first load (after a filter or search).

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| A router link or button as the action | `asChild` on `EmptyState.Action` and `EmptyState.Secondary` |
| Topic chips for zero search hits | the app's chip row as a child after `Description`; the layout needs no change |
| An app-local illustration treatment | `tv({ extend: emptyStateStyles, variants: { ... } })` |

## Variants

| Prop | Layout |
|---|---|
| `size="page"` | centred, `section` spacing role as vertical padding, illustration, `title-lg`; whole-page empties (empty library) |
| `size="section"` | centred in a section, `inset-card` x 2 padding, a smaller illustration; a shelf, a comment area, a table |
| `size="inline"` | start-aligned in a row, no illustration, `body` title; a dropdown or a small panel |
| `titleStyle="editorial"` | the title in `editorial` and `fg`, sentence case |

## States

| State | What changes |
|---|---|
| default | as drawn |
| editorial | `titleStyle="editorial"` on curated surfaces (You hub, Start here) |
| with suggestions | zero search hits: the app puts topic [chips](../apps/web/chip-bar.md) after the description |
| filtered | the title says the filter produced nothing, the action clears the filter |
| first-run | the action starts the first task (Upload a video) |
| skeleton | none: an empty state is not loading, it replaces the skeleton once data settles |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | the section illustration, `section` padding block and `gutter-compact` inline, action full width |
| medium | as `page` |
| expanded | as `page` |
| large | as `page`; text stays at 520 px |

## Motion

- Entry: fade at `base` with `enter`, no movement, so it never competes with the skeleton it replaces.
- The illustration is static.
- Reduced motion: no change; the entry fade is opacity.

## Accessibility

- The title is a heading at the level the caller chose (the element it passes), so the empty region has a place in the outline.
- `role="status"` when the empty state appears after an action (a filter, a search) so the change is announced once; `none` on first load.
- The illustration is `aria-hidden`; the action is a real button or link and is the first focus target inside the region.
- Contrast: `fg-muted` description at 7:1 on `bg`.

## Composition

`Button`, `Icon` or an illustration passed as a child. `Skeleton` is not used. Type styles: `title-lg`, `body`, `editorial`.

## Used by

- Web: [58, browse layout](../../tickets/58-modern-browse-layout-microinteractions-motion.md) (no videos, empty feeds); [59, watch page](../../tickets/59-video-watch-page-responsive-layout-enhancements.md) (no comments); [73, library](../../tickets/73-frontend-youtube-playlists-library-player-queue.md) (empty history, playlists, shelves); [74, search](../../tickets/74-frontend-multi-resource-search-discovery-ui.md) (zero results with suggested topics); the Shorts, live and notification shells in [95](../../tickets/95-design-system-2.md) section 7
- Studio: [60, creator studio](../../tickets/60-creator-studio-dashboard-video-management-ui.md) (no videos, no analytics yet, an empty table or chart)

## Workbench stories

- `page` size with illustration
- `section` size (empty shelf)
- `inline` size
- Editorial title style
- Zero results with topic chips
- Filtered, with a Clear filter action
- First-run with Upload a video
- Long title wrapping
- RTL
