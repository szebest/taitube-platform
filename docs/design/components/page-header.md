# PageHeader

The title block at the top of a page that is not a feed: a title, an optional description, and the actions for the page. It carries no signature move; it is where the editorial serif may appear for a one-line curator note. In `@vp/components` because web (You hub, library pages, settings) and every studio page render it.

## Anatomy

```
 ← Library                                                   1 breadcrumb or back
 ┌──────────────────────────────────────────────────────────┐
 │ 2 Your videos                       [3 Filter] [4 Upload] │
 │ 5 142 videos, 3 still processing                          │
 │ 6 [ All ] [ Published ] [ Drafts ]                        │
 └──────────────────────────────────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Back or breadcrumb | optional, a link slot |
| 2 | Title | `headline` on large and expanded, `title-lg` below, `display` for `titleStyle="display"`; `text-wrap: balance`, one `h1` per page |
| 3 | Secondary actions | `Button` `outline` fill or `IconButton` |
| 4 | Primary action | one `Button` `solid` fill at most |
| 5 | Description | `body` in `fg-muted`, stops at the reading measure (68 ch); `editorial` type style when the title is `display` |
| 6 | Tabs slot | optional `Tabs` or `SegmentedControl` bound to a search param by the app |

## Props

Plus the standard props. The title is the heading element the caller passes, so there is no level prop. Density is not a prop: the `compact` spacing and `small` sizing sets shrink the header on their own (studio's default).

```ts
// types.ts
import type { TypeStyleOption } from '@vp/design-tokens';

export type PageHeaderTitleStyle = Extract<TypeStyleOption, 'headline' | 'display'>;
```

```ts
interface PageHeaderRootProps {
  titleStyle?: PageHeaderTitleStyle; // default 'headline'; 'display' for curated pages such as the You hub
  sticky?: boolean;                  // pins under the toolbar; gains a divider border on scroll
}
// Parts: PageHeader.Root, .Back, .Title, .Description, .Actions, .Tabs
```

```tsx
<PageHeader.Root titleStyle="display">
  <PageHeader.Back asChild><Link to="/feed/you">Library</Link></PageHeader.Back>
  <PageHeader.Title><h1>Your videos</h1></PageHeader.Title>
  <PageHeader.Description>142 videos, 3 still processing</PageHeader.Description>
  <PageHeader.Actions><Button fill="outline">Filter</Button><Button>Upload</Button></PageHeader.Actions>
  <PageHeader.Tabs>...</PageHeader.Tabs>
</PageHeader.Root>
```

`PageHeader.Actions` folds all but its last child into one menu when space runs out.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part, merged with `cn` |
| A router link for the back part | `asChild` on `PageHeader.Back` |
| An extra region (a status pill beside the title) | any element inside `PageHeader.Root`, or a part in the app reading `usePageHeader()` |
| An app-local variant | `tv({ extend: pageHeaderStyles, variants: { ... } })` |

## Variants

| Prop value | Layout difference |
|---|---|
| `titleStyle="headline"` | as drawn, divider border (`border` role, divider width) under the tabs when tabs are set |
| `titleStyle="display"` | description in `editorial` type, title in `display`, for curated pages |
| compact spacing and small sizing sets | title `title-lg`, no description gap, header at `control.lg` height minimum; no code path, the tokens do it |

## States

| State | What changes |
|---|---|
| rest | as drawn |
| sticky | `sticky` set: a divider border at the bottom on scroll |
| actions overflowing | secondary actions fold into one `DropdownMenu` button, the primary action stays |
| no description, no tabs | title and actions only, one `layout.header` high |
| skeleton | `PageHeaderSkeleton`, dimensions in [skeletons](skeletons.md) |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | title `title-lg`, actions wrap under the title, primary action full width, tabs scroll horizontally |
| medium | actions inline at the end, description under the title |
| expanded | title `headline`, actions inline |
| large | as expanded, `display` when `titleStyle="display"` |

## Motion

- Sticky border fade: `fast`.
- Actions folding into the menu is instant, never animated.
- No entry motion; the header is part of the first paint.
- Reduced motion: nothing changes.

## Accessibility

- Renders the heading element the caller passes, normally the page's one `h1`. The back link is a `nav aria-label="Breadcrumb"` with `aria-current` on the last item.
- Tabs inside the header keep their own roles; the header does not wrap them in a landmark.
- Focus order follows reading order: back, title (not focusable), actions in DOM order.

## Composition

`Button`, `IconButton`, `DropdownMenu` (overflow), `Tabs` or `SegmentedControl` (slot), `Icon`. Copy for the overflow menu's name comes from `useUiCopy()`.

## Used by

- Web: [72, settings](../../tickets/72-frontend-settings-customization-system.md) and [73, library](../../tickets/73-frontend-youtube-playlists-library-player-queue.md) (History, Watch later, Playlists)
- Studio: [60, creator studio](../../tickets/60-creator-studio-dashboard-video-management-ui.md) every page; [61, admin control panel](../../tickets/61-admin-control-panel-category-moderation-ui.md)

## Workbench stories

- Title only
- Title, description and one primary action
- With tabs and two secondary actions
- Display title ("Your evening, in order")
- Back link
- Actions overflowing at compact
- Long title balanced across two lines
- Compact spacing and small sizing, sticky
- Skeleton
