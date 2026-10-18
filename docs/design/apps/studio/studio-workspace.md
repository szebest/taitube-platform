# StudioWorkspace

The creator studio's frame: a navigation column, a toolbar, the content, and an inspector for the selected item. It lives in the studio's kit, `apps/client/studio/src/components/workspace/studio-workspace/` ([README](README.md)). The studio starts on the `compact` spacing and `small` sizing sets, which this frame follows through tokens, with no prop.

## Anatomy

```
┌────────────┬─────────────────────────────────────────┬──────────────────┐
│ 1 nav      │ 2 toolbar: [search]  filters   [Upload]  │ 4 inspector      │
│ Dashboard  ├─────────────────────────────────────────┤ Selected: Lisbon │
│ Videos     │                                         │ at night         │
│ Analytics  │ 3 content                               │ Visibility  ...  │
│ Comments   │                                         │ Stats            │
│ Settings   │                                         │ [Edit] [Delete]  │
└────────────┴─────────────────────────────────────────┴──────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Navigation | `layout.rail-expanded` wide, `border` on the inline end; collapses to `layout.rail-collapsed` |
| 2 | Toolbar | `layout.header` high, sticky, page-level actions and filters |
| 3 | Content | scrolls independently; table, charts, forms |
| 4 | Inspector | a fixed width (the workspace's own layout constant, 320 px, as no sizing token exists for it), `border` on the inline start, shows the selected row; empty until a row is chosen |

## Props

Plus the standard props. The viewport decides the layout, so there is no layout prop.

```ts
// types.ts
import type { Side } from '@vp/ui';

export type InspectorSide = Extract<Side, 'inline-end' | 'inline-start'>;
export type WorkspaceLayout = 'three-column' | 'two-column' | 'single';
```

```ts
interface StudioWorkspaceRootProps {
  inspectorOpen?: boolean;
  onInspectorOpenChange?: (open: boolean) => void;
  inspectorSide?: InspectorSide;   // default 'inline-end'
}
interface StudioWorkspaceNavItemProps {
  active?: boolean;                // sets aria-current="page"
}
interface StudioWorkspaceInspectorProps {
  title: string;                   // names the aside
}
// Parts: StudioWorkspace.Root, .Nav, .NavItem, .Toolbar, .Content, .Inspector
```

```tsx
<StudioWorkspace.Root inspectorOpen={!!selected} onInspectorOpenChange={clear}>
  <StudioWorkspace.Nav><StudioWorkspace.NavItem asChild active><Link to="/videos">Videos</Link></StudioWorkspace.NavItem></StudioWorkspace.Nav>
  <StudioWorkspace.Toolbar>...</StudioWorkspace.Toolbar>
  <StudioWorkspace.Content>{outlet}</StudioWorkspace.Content>
  <StudioWorkspace.Inspector title="Shot entirely on a 1998 camcorder">...</StudioWorkspace.Inspector>
</StudioWorkspace.Root>
```

`WorkspaceLayout` is what the root derives from the viewport and puts in context (`useStudioWorkspace().layout`); it is not a prop.

## Smart wrappers

| Wrapper | Folder | Props | Hooks |
|---|---|---|---|
| `StudioShell` | `features/shell/components/` | none | `useMatchRoute` (active nav item), `useCan` (hides admin links), `useUploadProgress` (the strip under the toolbar), `useSelectedVideo` (the inspector's video id from the route search), `useT` (nav labels) |
| `VideoInspector` | `features/content/components/` | `videoId: string` | `useSuspenseQuery(videoQueryOptions)`, `useFormat`, `useT`, `useCan`, `useVideoActions` |

`StudioShell` fixes the nav items, the toolbar's Upload button and the open-inspector rule; the layout route renders `<StudioShell>{outlet}</StudioShell>` and nothing else. `VideoInspector` is passed as the `Inspector` child by the page that owns the selection.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| A router link as a nav item | `asChild` on `StudioWorkspace.NavItem` |
| An extra region (a status banner above the content) | any element inside `Root`, or a part reading `useStudioWorkspace()` (layout, navCollapsed, inspectorOpen) |
| An app-local look | `tv({ extend: studioWorkspaceStyles, variants: { ... } })` |

## Variants

| `layout` (derived) | Difference |
|---|---|
| `three-column` | three columns above 1280 px |
| `two-column` | 1024 to 1279 px: nav collapsed to `layout.rail-collapsed`, inspector becomes an overlay panel |
| `single` | below 1024 px: nav in a `Drawer`, inspector in a sheet (`Dialog.Content`, bottom form `Drawer`) |

## States

| State | What changes |
|---|---|
| rest | as drawn |
| nothing selected | the inspector shows its empty text (`useUiCopy()`: "Select a video to see its details") |
| selected | the inspector shows the item, focus is not moved |
| nav collapsed | icons only with tooltips |
| inspector overlay | `scrim` behind it, focus trapped, Escape closes |
| uploading | a progress strip under the toolbar, `border.focus` high, `accent` |
| skeleton | `StudioWorkspaceSkeleton`, see below |

## Skeleton

`StudioWorkspaceSkeleton`: nav `layout.rail-expanded` wide, toolbar `layout.header` high, inspector at the workspace's inspector width (absent below `three-column`), the content area a `PageHeaderSkeleton` plus the page's own skeleton. It renders the frame, never a spinner, so the first paint already has the final layout.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | one column, a menu button opens the nav drawer, the inspector is a bottom sheet |
| medium | collapsed nav, content, inspector as an overlay |
| expanded | collapsed nav, inspector overlay below 1280 px |
| large | nav at `layout.rail-expanded`, content, docked inspector |

## Motion

- Inspector slide in as an overlay: `base` with `enter`, out with `exit`.
- Nav collapse width: `base` with `settle`.
- Docked inspector appears without a slide, content width changes at `fast`.
- Reduced motion: opacity only.

## Accessibility

- Landmarks: `nav` (labelled "Studio"), `header` toolbar with `role="toolbar"`, `main`, `aside` labelled by the inspector title.
- Skip link to `main`. The inspector follows the content in DOM order so focus order matches reading order; selecting a row does not steal focus, and a "Details" shortcut moves focus into the inspector.
- Overlay inspector: modal dialog, focus returns to the row on close.
- Keyboard: arrow keys in the nav, Tab through the toolbar, Escape closes overlays.

## Composition

`ScrollArea`, `IconButton`, `Drawer`, `Dialog` (sheet), `Tooltip`, `Separator`, `Button`.

## Used by

- [60, creator studio](../../../tickets/60-creator-studio-dashboard-video-management-ui.md): the `_authed` layout, through `StudioShell`
- [93, studio app](../../../tickets/93-creator-studio-separate-app.md): the shell the studio mounts

## Workbench stories

- Large with an empty inspector
- Large with a selected video
- Medium with the overlay inspector
- Compact with drawer and sheet
- Nav collapsed
- Uploading strip
- RTL
- Skeleton
