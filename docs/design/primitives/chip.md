# Chip

A pill-shaped toggle or link for filtering and categorising, used in the home chip bar and in input lists; ChipGroup holds a set.

## Anatomy

```
   ( (1) icon  (2) Music  (3) x )        a Chip
   [ Chip ] [ Chip ] [ Chip ] >          (4) a ChipGroup, scrolls
```

| # | Part | Notes |
|---|---|---|
| 1 | Start icon | Optional `Icon` at `IconSize` `sm`. |
| 2 | Label | `label` type style. |
| 3 | `Chip.Remove` | Optional; its own labelled button. |
| 4 | `ChipGroup` | A row that manages selection and keyboard. |

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type ChipFill = Extract<FillOption, 'soft' | 'outline'>;
export type ChipSize = Extract<ControlSize, 'sm' | 'md'>;
```

```ts
interface ChipRootProps extends ComponentPropsWithRef<'button'> {
  variant?: ChipFill;    // default 'soft'
  size?: ChipSize;       // default 'sm'
}
interface ChipGroupRootProps extends ComponentPropsWithRef<typeof ToggleGroup.Root> { // type, value, onValueChange
  size?: ChipSize;
}
// Parts: Chip.Root, Chip.Remove (a labelled button child), ChipGroup.Root, ChipGroup.Item (value)
```

Selection is the native `aria-pressed` on a lone chip, or the group's `value`; as a link (`asChild`) the selected chip carries `aria-current`. New in 95; the stand-in is `.tt-chip` and `.tt-chipbar`. A chip is not a [badge](badge.md) (static) or a [button](button.md) (an action). The old `tint` variant is `soft`.

```tsx
<ChipGroup.Root type="single" aria-label="Category" value={category} onValueChange={setCategory}>
  <ChipGroup.Item value="all">All</ChipGroup.Item>
  <ChipGroup.Item value="music">Music</ChipGroup.Item>
</ChipGroup.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `soft` | rest `tint`; selected `fg` ground with `bg` text | Category bar, filters. The selected chip is the inverse of the rest. |
| `outline` | `border-strong` outline; selected `accent-soft` with `accent-ink` | Tags on a busy ground, removable values. |

Sizes `sm` is `sizing.control.sm`, `md` is `sizing.control.md`, with a `sizing.layout.touch-target` hit area under a coarse pointer. Radius `chip` (a pill in Sand, 6 px in Nocturne). Type `label`. Inline padding `spacing.inset-control` and `gap-inline` between parts.

## States

| State | What changes |
|---|---|
| Rest | Per variant. |
| Hover | `tint-strong` ground (`tint`), `tint` (`outline`), `fast`. |
| Focus-visible | `focus-ring`, `border.focus` wide with `border.focus-offset`. |
| Pressed | `scale(0.97)` over `motion.duration.instant`. |
| Selected | Per variant, `aria-pressed="true"`. |
| Disabled | `tint` ground, `fg-subtle`. |
| Scrolling | In a scrollable group, edge fades and the selected chip scrolls into view. |

## Selection indicator

The selected state is one pill (single-select `ChipGroup` only) that slides to the chosen option, rather than each option painting its own
ground: it moves and resizes over `duration-base` with `ease-settle` from the motion set, follows a resize, a
direction change and (in a scrolling group) the scroll, and does not animate its first placement. The pill is `fg` with the `chip` radius role; a multi-select group keeps per-chip state and has no indicator. The
selected option keeps its text colour change, so the state reads even before the indicator arrives. Under the
`reduced` motion set (chosen, or forced by `prefers-reduced-motion`) the indicator changes position without
sliding. One shared helper in `@vp/ui` measures the selected option and drives the indicator for every group
that has one (`useSlidingIndicator`); no component positions its own.

## Tokens

- Colour roles `tint`, `tint-strong`, `fg`, `bg`, `fg-muted`, `fg-subtle`, `border-strong`, `accent-soft`, `accent-ink`, `focus-ring`.
- `sizing`: `control` sm, md, `icon.sm`, `layout.touch-target`. `spacing`: `inset-control`, `gap-inline`.
- `radius`: `chip`. `border`: `control`, `focus`, `focus-offset`. Type `label`.
- `motion`: `fast`, `instant`.

## Accessibility

- Selectable chips are toggle buttons with `aria-pressed`; as links the selected one has `aria-current="true"`.
- A single-select group uses roving focus (one tab stop, arrows move, Home and End jump), built on Radix ToggleGroup; the group has `role="group"` and an `aria-label`.
- The remove button is separate, labelled "Remove Music", and Backspace or Delete on a focused chip also removes it.
- Selection is not colour alone: the selected chip inverts its ground and text.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Chip.Root` (a router link) and `ChipGroup.Item`.
- `useChip()` returns `{ variant, size }` and `useChipGroup()` the group's `{ size, value }`, so a part written in an app can read them.
- `chipStyles`, the `tv()` definition, is exported: `tv({ extend: chipStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do keep the label to one or two words.
- Do put "All" first and selected by default in a category bar.
- Do keep the selected value in the URL when it is a view (the `category` search param).
- Don't use a chip for an action; use a button.
- Don't wrap a group to many lines on the home bar; it scrolls.
- Don't use more than one selected chip in a single-select group.

## In the workbench

Stories: each variant (2) and size (2), selected, removable, with icon, as a link, disabled, single and multiple groups, overflowing scroll with fades. States: rest, hover, focus-visible, pressed, selected, disabled. Axes: themes by modes (Nocturne is squarer), RTL (scroll direction), compact density, reduced motion, more contrast, 320 px width.
