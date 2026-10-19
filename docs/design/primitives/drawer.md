# Drawer

A sheet that rises from the bottom edge on compact screens, draggable to dismiss, used where a menu or dialog would be too small to touch.

## Anatomy

```
   ::::::::::::::: scrim :::::::::::::::
   +-----------------------------------+
   |            (1) grab handle        |
   | (2) Title                         |
   | (3) Body (scrolls)                |
   | (4) Footer                        |
   +-----------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Drawer.Handle` | Short bar in `border-strong`; the drag affordance. |
| 2 | `Drawer.Title` | `title-lg`. Required. |
| 3 | `Drawer.Body` | Scrolls when taller than the available height. |
| 4 | `Drawer.Footer` | Safe-area padded actions. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type DrawerSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
```

```ts
interface DrawerContentProps extends ComponentPropsWithRef<'div'> {
  size?: DrawerSize;                      // max height 40, 70, 92 percent; default 'md'
  snapPoints?: number[];                  // fractions of viewport height, default [1]
}
// Parts: Drawer.Root (open, onOpenChange), .Trigger, .Content, .Handle, .Title, .Description, .Body, .Footer, .Close
```

A drawer always rises from the `block-end` edge (the shared `Side`), so it has no `side` prop; a surface from another edge is a [dialog](dialog.md) with `side`. It is built on the dialog engine ([dialog](dialog.md)) with pointer-drag added in-house, so there is no second modal implementation. The close button's label is `close` from `useUiCopy()` ([ui-copy-provider](ui-copy-provider.md)). A drawer that must not be dragged away intercepts the native dismiss events. Today the only equivalent is `SheetContent side="bottom"`.

On a pointer device of expanded width and up, the same call site should render a [popover](popover.md) or [dialog](dialog.md); the responsive choice belongs to a pattern.

```tsx
<Drawer.Root>
  <Drawer.Trigger asChild><Button>Queue</Button></Drawer.Trigger>
  <Drawer.Content size="lg" snapPoints={[0.5, 1]}>
    <Drawer.Handle />
    <Drawer.Title>Your queue</Drawer.Title>
    <Drawer.Body>...</Drawer.Body>
  </Drawer.Content>
</Drawer.Root>
```

## Variants and sizes

| Size | Max height | When to use |
|---|---|---|
| `sm` | 40 percent | Quick choices: sort order, share targets. |
| `md` | 70 percent | Menus with many rows, filters. |
| `lg` | 92 percent | The queue and discussion sheets. |

Roles: `raised` ground, `border` top edge, `scrim` overlay, radius `sheet` on the top corners only. Padding is `spacing.inset-card`.

## States

| State | What changes |
|---|---|
| Open | Slides up over `motion.duration.slow` with `enter`; overlay fades. |
| Dragging | Follows the pointer 1:1; overlay opacity tracks the offset. |
| Release | Past 30 percent or a fast flick closes with `exit`; otherwise settles back with easing `settle`. |
| Snap | Moves between `snapPoints` with `settle`. |
| Focus-visible | `focus-ring` on the focused control; the handle is focusable and moves the sheet with arrow keys. |
| Reduced motion | Opacity only; drag still works but does not animate on release. |
| Not dismissible | The caller cancels the native dismiss events; the handle stays as a visual cue. |

## Tokens

- Colour roles `raised`, `border`, `border-strong`, `scrim`, `fg`, `fg-muted`.
- `spacing`: `inset-card`, `gap-stack`. `radius`: `sheet`. `border`: `divider`. `shadow`: elevation 3.
- `sizing`: `layout.touch-target` for the handle's hit area.
- Type `title-lg`, `body-sm`. `motion`: `slow`, easings `enter`, `exit`, `settle`. z `modal`.

## Accessibility

- Same as Dialog: `role="dialog"`, `aria-modal`, focus trap, focus return, Escape closes.
- Dragging is never the only way to close: the title row includes a labelled close button reachable by keyboard.
- Scroll inside the body does not drag the sheet unless the body is at the top.
- Respect the bottom safe area with `padding-block-end: env(safe-area-inset-bottom)`.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger`, `Close`, `Title` and `Description`.
- `useDrawer()` returns `{ size, open, snapPoint }`, so a part written in an app can read it.
- `drawerStyles`, the `tv()` definition, is exported: `tv({ extend: drawerStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do use it for the compact version of a menu or sheet.
- Do keep the title short; it names the dialog.
- Do give long content a `lg` size rather than nested scroll areas.
- Don't use it on pointer devices at expanded width; use a popover or dialog.
- Don't stack drawers.
- Don't put a primary action only in the footer if the body is long; the footer stays pinned for that reason.

## In the workbench

Stories: size sm, md, lg; with snap points; long body scrolling; not dismissible; with footer actions; mid-drag frame; keyboard open (no animation); over a video page. Axes: themes by modes, compact density, reduced motion, RTL, 320 px width, landscape phone (92 percent clamps).
