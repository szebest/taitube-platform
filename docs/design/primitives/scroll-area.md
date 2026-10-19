# ScrollArea

A scrollable region with a themed scrollbar and optional edge fades, for content that overflows a fixed box.

## Anatomy

```
   +----------------------------+--+
   | (1) viewport               |  |
   |  content ...               |(2)|  vertical scrollbar
   +----------------------------+--+
   [====(3) horizontal scrollbar =]
```

| # | Part | Notes |
|---|---|---|
| 1 | Viewport | The scrolling box, native scroll behaviour and momentum; built in. |
| 2 | Scrollbar | A thin track with a thumb; vertical or horizontal; built in. |
| 3 | Corner | Where both bars meet. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type ScrollAreaSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface ScrollAreaProps extends ComponentPropsWithRef<typeof ScrollArea.Root> { // Radix: type, scrollHideDelay
  size?: ScrollAreaSize;             // scrollbar 6 or 10 px; default 'md'
  fade?: boolean;                    // edge fade where content is clipped; default false
}
// Parts: ScrollArea (root with viewport and bars built in)
```

`type` is the Radix prop (`hover` by default; `auto`, `always`, `scroll`). The bars render for the axes that overflow. Scrollbar thicknesses are component measures (no sizing token covers a bar). New in 95; the shelf scroller and menus with long lists are the users.

```tsx
<ScrollArea size="sm" fade className="max-h-80">...</ScrollArea>
```

## Variants and sizes

| Size | Scrollbar | When to use |
|---|---|---|
| `sm` | 6 px | Menus, command lists, popovers. |
| `md` | 10 px | Panels, the queue, the rail. |

Roles: thumb `border-strong`, thumb hover `fg-muted`, track transparent. Thumb radius `chip`. The fade uses `bg` or `raised` (inherited from the surface) at the clipped edge, `spacing.gutter-compact` wide.

## States

| State | What changes |
|---|---|
| Rest | Bars hidden with `type="hover"`. |
| Hover | Bars fade in over `motion.duration.fast`. |
| Scrolling | Bars visible; hide after `scrollHideDelay` (600 ms). |
| Thumb hover | `fg-muted`. |
| Thumb dragging | `fg-muted` and the track shows `tint`. |
| Focus-visible | `focus-ring` on the viewport when it is focusable. |
| Reduced motion | Fades become instant. |

## Tokens

- Colour roles `border-strong`, `fg-muted`, `tint`, `bg`, `raised`, `focus-ring`.
- `spacing`: `gutter-compact` (fade width). `radius`: `chip`. `border`: `focus`, `focus-offset`.
- `motion`: `fast`, `base`. Touch devices keep native overlay scrollbars.

## Accessibility

- Radix ScrollArea keeps native scrolling, so keyboard (arrows, Page Up and Down, Home and End, Space) and screen readers work.
- A viewport that has no focusable content should itself be focusable (`tabIndex={0}`) with a name, so keyboard users can scroll it; Radix does not add this.
- The custom bars are `aria-hidden`; they are not controls.
- Do not trap wheel events or change scroll direction.

## Do and don't

- Do use it for long lists inside a fixed height (menus, queue).
- Do add `fade` on horizontal shelves so clipping is clear.
- Do make a scrolling region keyboard reachable.
- Don't wrap the whole page; the page scrolls natively.
- Don't hide scrollbars entirely on pointer devices.
- Don't nest scroll areas on the same axis.

## In the workbench

Stories: vertical, horizontal, both, each size, with fade, `type` hover and always, long menu, shelf with snap, keyboard focus on the viewport. Axes: themes by modes, RTL (the bar moves to the start edge, horizontal fade flips), reduced motion, coarse pointer (native bars).
