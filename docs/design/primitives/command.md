# Command

A filterable list with a search input: the base for the command palette and for comboboxes that outgrow a select.

## Anatomy

```
   +----------------------------------------+
   | (1) o  Type a command or search...  (2)|
   |----------------------------------------|
   | (3) GROUP HEADING                      |
   | (4) icon  Item                  (5) K  |
   | (4) icon  Item                         |
   | (6) Empty: No results                  |
   +----------------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Command.Input` | Search field, icon at the start. |
| 2 | Clear or hint | A clear button when text exists, or a [kbd](kbd.md). |
| 3 | `Command.Group` | With a heading in `overline`. |
| 4 | `Command.Item` | Row at `sizing.control` sm or md; value, keywords, icon. |
| 5 | `Command.Shortcut` | Right-aligned Kbd. |
| 6 | `Command.Empty` | Rendered when nothing matches; with no children it prints `noResults` from [ui-copy-provider](ui-copy-provider.md). |

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';

export type CommandVariant = 'inline' | 'palette';
export type CommandSize = Extract<ControlSize, 'sm' | 'md'>;
```

```ts
interface CommandRootProps extends ComponentPropsWithRef<typeof Command> {  // cmdk props: value, filter, shouldFilter, loop
  variant?: CommandVariant;  // default 'inline'
  size?: CommandSize;        // default 'md'
}
// Parts: Command.Root, .Input, .List, .Empty, .Loading, .Group (heading), .Item (value, keywords, onSelect),
//   .Separator, .Shortcut, .Dialog
```

`CommandVariant` stays component-local: it names a surface (a list in a popover, a palette in a dialog), not a fill. It is built on a headless command-menu library (cmdk) bundled with the app, not Radix; `Command.Dialog` wraps [dialog](dialog.md). Set `shouldFilter={false}` when results arrive from the server (the palette). New in 95; the `CommandPalette` pattern composes it.

```tsx
<Command.Root variant="palette" aria-label="Search and actions">
  <Command.Input />
  <Command.List>
    <Command.Empty />
    <Command.Group heading="Actions">
      <Command.Item value="theme">Switch theme <Command.Shortcut><Kbd>T</Kbd></Command.Shortcut></Command.Item>
    </Command.Group>
  </Command.List>
</Command.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `inline` | `raised`, `border`, radius `card` | A combobox popover content, a filter list inside a [popover](popover.md). |
| `palette` | `raised`, `border`, radius `sheet`, elevation 3 | The global `/` and Cmd K palette in `Command.Dialog`. |

| Size | Row | Input |
|---|---|---|
| `sm` | `sizing.control.sm` | `sizing.control.md` |
| `md` | `sizing.control.md` | `sizing.control.lg` |

## States

| State | What changes |
|---|---|
| Rest | Items on `raised`. |
| Highlighted | `tint` ground (`data-selected`), the focus indicator; moved by arrows or pointer. |
| Focus-visible | The input keeps DOM focus; `focus-ring` on the input. |
| Loading | `Command.Loading` row with a [spinner](spinner.md); items stay interactive. |
| Empty | `Command.Empty` line. |
| Disabled item | `fg-subtle`, skipped. |
| Open (palette) | Opens with no animation when keyboard-triggered, per the guide; `slow` fade otherwise. |

## Tokens

- Colour roles `raised`, `border`, `fg`, `fg-muted`, `fg-subtle`, `tint`, `accent-ink`, `danger-ink`.
- `sizing`: `control` sm, md, lg. `spacing`: `inset-control`, `gap-inline`.
- `radius`: `card` or `sheet`, items `sm`. `border`: `divider`. `shadow`: elevation 3 for `palette`.
- Type `body` (input), `label` (item), `overline` (heading), `mono` (shortcut).
- `motion`: `fast`, `slow`, easing `enter`. z `modal` for the palette.

## Accessibility

- Input is `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is `role="listbox"` with `option` items and `group` headings.
- DOM focus stays in the input; arrows move the active option, Enter selects, Escape clears then closes, Home and End jump.
- The list needs an `aria-label`. Announce counts through a polite live region ("12 results").
- The palette dialog has a hidden title via [visually-hidden](visually-hidden.md).

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Command.Item` and `Command.Group`.
- `useCommand()` returns `{ variant, size }`, so a part written in an app can read it.
- `commandStyles`, the `tv()` definition, is exported: `tv({ extend: commandStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do set `shouldFilter={false}` when the server ranks results.
- Do give every item a stable `value` and `keywords`.
- Do show shortcuts with `Command.Shortcut`.
- Don't use it for fewer than about 7 options; use a [select](select.md) or [segmented-control](segmented-control.md).
- Don't put destructive actions first; group and label them.
- Don't animate a keyboard-opened palette.

## In the workbench

Stories: inline list, palette dialog, grouped, with shortcuts, loading, empty, server-filtered, long list scrolling with a [scroll-area](scroll-area.md), disabled items. States: highlighted, focus, empty, loading. Axes: themes by modes, RTL, compact density, reduced motion, 320 px width.
