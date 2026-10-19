# Tabs

A set of peer views in the same place, one visible at a time, switched by a row of triggers.

## Anatomy

```
   (1) Home   Videos   Shorts   Live   Playlists   (2) About
   ====(3)=====
   (4) panel content
```

| # | Part | Notes |
|---|---|---|
| 1 | `Tabs.Tab` | Text, optional count or icon. |
| 2 | `Tabs.List` | Scrolls horizontally when it overflows; the active tab scrolls into view. |
| 3 | Indicator | `border.focus`-thick bar in `accent` under the selected trigger (`ghost`), or a filled ground (`soft`). |
| 4 | `Tabs.Panel` | The panel for each trigger. |

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';
import type { FillOption, Orientation } from '../../types';

export type TabsFill = Extract<FillOption, 'ghost' | 'soft'>;
export type TabsSize = Extract<ControlSize, 'sm' | 'md'>;
export type TabsOrientation = Orientation;
```

```ts
interface TabsRootProps extends ComponentPropsWithRef<typeof Tabs.Root> { // Radix: value, onValueChange, activationMode
  variant?: TabsFill;              // 'ghost' draws a line under the selected tab, 'soft' a ground; default 'ghost'
  size?: TabsSize;                 // default 'md'
  orientation?: TabsOrientation;   // default 'horizontal'
}
// Parts: Tabs.Root, Tabs.List, Tabs.Tab (value), Tabs.Panel (value)
```

`variant`, `size` and `orientation` are set once on `Tabs.Root` and reach the parts through context. The old `line` variant is `ghost` (no ground, an indicator bar) and `pill` is `soft`. A count or icon is a child of the trigger. Today's `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` become `Tabs.Root`, `.List`, `.Tab` and `.Panel`, and gain `variant`. Channel tabs are route-driven: render `Tabs.Tab asChild` with a router link and let the route control `value`; a tab whose feature has not shipped is not rendered.

```tsx
<Tabs.Root defaultValue="videos" variant="ghost">
  <Tabs.List>
    <Tabs.Tab value="videos">Videos</Tabs.Tab>
    <Tabs.Tab value="shorts">Shorts</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="videos">...</Tabs.Panel>
  <Tabs.Panel value="shorts">...</Tabs.Panel>
</Tabs.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `ghost` | list border `border`; selected text `fg` with an `accent` bar; others `fg-muted` | Page-level tabs: the channel page. |
| `soft` | selected `tint-strong` ground with `fg`; others `fg-muted` | In a card or sheet, where a baseline would clash. |

Sizes: `md` triggers are `sizing.control.md` high, `sm` are `sizing.control.sm`; the gap between triggers is `spacing.gap-inline`. `soft` triggers use radius `chip`. Type `label`.

## States

| State | What changes |
|---|---|
| Rest | `fg-muted` text. |
| Hover | Text `fg`; `tint` ground on `soft`. |
| Focus-visible | `focus-ring` on the trigger, `border.focus` wide with `border.focus-offset`. |
| Selected | `fg` text and the indicator; the bar slides over `motion.duration.base` with `settle`. |
| Pressed | `tint-strong` ground. |
| Disabled | `fg-subtle`, skipped by arrows. |
| Overflow | Edge fade at the list ends, scroll buttons on pointer devices. |

## Selection indicator

The selected state is one underline that slides to the chosen option, rather than each option painting its own
ground: it moves and resizes over `duration-base` with `ease-settle` from the motion set, follows a resize, a
direction change and (in a scrolling group) the scroll, and does not animate its first placement. The underline is `accent`, two pixels, on the block-end edge of the list. The
selected option keeps its text colour change, so the state reads even before the indicator arrives. Under the
`reduced` motion set (chosen, or forced by `prefers-reduced-motion`) the indicator changes position without
sliding. One shared helper in `@vp/ui` measures the selected option and drives the indicator for every group
that has one (`useSlidingIndicator`); no component positions its own.

## Tokens

- Colour roles `fg`, `fg-muted`, `fg-subtle`, `border`, `accent`, `tint`, `tint-strong`, `focus-ring`.
- `sizing`: `control` sm, md. `spacing`: `gap-inline`, `inset-control`. `radius`: `chip`. `border`: `divider`, `focus`, `focus-offset`.
- Type `label`; a tab count is a child in `mono`. `motion`: `base`, `fast`, easing `settle`.

## Accessibility

- Radix Tabs: `role="tablist"`, `tab` with `aria-selected` and `aria-controls`, `tabpanel` with `aria-labelledby`.
- Tab moves into the list once, arrow keys move between triggers (Left and Right, reversed in RTL; Up and Down when vertical), Home and End jump. Automatic mode selects on arrow; manual selects on Enter or Space.
- Panels are focusable only when they have no focusable content; they take `focus-ring`.
- When tabs are links, use `aria-current="page"` and drop the tab roles: that is navigation, not tabs, so render the same visual as a nav list.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Tabs.Tab` (a router link).
- `useTabs()` returns `{ variant, size, orientation, value }`, so a part written in an app can read it.
- `tabsStyles`, the `tv()` definition, is exported: `tv({ extend: tabsStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do keep labels to one or two words.
- Do use `manual` activation when a panel is expensive to load.
- Do keep the panels in the same place and size where possible.
- Don't use tabs for steps in a flow.
- Don't nest tabs.
- Don't hide a tab; remove it.

## In the workbench

Stories: each variant (2) and size (2), with counts, with icons, overflowing list scrolling, vertical, route-driven with links, disabled tab, manual activation. States: rest, hover, focus-visible, selected, disabled. Axes: themes by modes, RTL, compact density, reduced motion (the bar jumps), more contrast, 320 px width.
