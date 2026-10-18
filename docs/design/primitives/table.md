# Table

Semantic table markup with the system's density, borders and states. It draws and structures; it never sorts, selects or pages: that state stays with the caller (studio's `DataTable` composes it).

## Anatomy

```
   +-------------------------------------------------+
   | (1) Caption                                     |
   |-------------------------------------------------|
   | (2) Head   | (2) Head  (sort button) | (2) Head |   (3) Header, optionally sticky
   |-------------------------------------------------|
   | (4) Cell   | (4) Cell                | (4) Cell |   (5) Row
   | (4) Cell   | (4) Cell                | (4) Cell |
   |-------------------------------------------------|
   | (6) Footer: totals or pagination slot           |
   +-------------------------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Table.Caption` | The table's name; visually hidden or shown above, always present. |
| 2 | `Table.Head` | A `th` with `scope`; `label` type in `fg-muted`. It draws no sort control: the caller puts a button inside and sets `aria-sort`. |
| 3 | `Table.Header` | The `thead`; sticky with `stickyHeader`. |
| 4 | `Table.Cell` | A `td` (or `th scope="row"` through `asChild`); `body-sm`, `align` by `Align`. |
| 5 | `Table.Row` | A `tr` with the divider, hover and selected grounds. |
| 6 | `Table.Footer` | The `tfoot`, for totals or a pagination bar the caller supplies. |

`Table.Body` is the `tbody`. `Table.Root` renders a scroll container around the `table`, so a wide table scrolls inside the page rather than breaking it.

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';
import type { Align } from '../../types';

export type TableSize = Extract<ControlSize, 'sm' | 'md'>;
export type TableAlign = Align;
```

```ts
interface TableRootProps extends ComponentPropsWithRef<'table'> {
  size?: TableSize;        // row height: control md (comfortable) or sm (dense); default 'md'
  stickyHeader?: boolean;  // pin the header to the top of the scroll container; default false
}
interface TableHeadProps extends ComponentPropsWithRef<'th'> {
  align?: TableAlign;      // default 'start'
}
interface TableCellProps extends ComponentPropsWithRef<'td'> {
  align?: TableAlign;      // default 'start'; 'end' for numbers
}
interface TableRowProps extends ComponentPropsWithRef<'tr'> {
  selected?: boolean;      // the selected ground; sets aria-selected for the caller's state
}
// Parts: Table.Root, .Caption, .Header, .Body, .Row, .Head, .Cell, .Footer
```

The root holds `size` and `stickyHeader` and shares them with the parts through context. The table is styling and semantics only: there is no `sort`, `onSelect` or `page` prop. A sortable column is a `Table.Head` holding an [icon-button](icon-button.md) or [button](button.md) with `aria-sort` set by the caller; a selectable row is a [checkbox](checkbox.md) in the first `Table.Cell` and `selected` on the `Table.Row`. Row clicks are the caller's `onClick`. Pagination and virtualisation belong to the app kit's `DataTable`.

```tsx
<Table.Root size="sm" stickyHeader>
  <Table.Caption>Your videos</Table.Caption>
  <Table.Header>
    <Table.Row>
      <Table.Head>Title</Table.Head>
      <Table.Head align="end" aria-sort="descending">
        <Button variant="ghost" size="sm" onClick={sortByViews}>Views</Button>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {rows.map((row) => (
      <Table.Row key={row.id} selected={selection.has(row.id)}>
        <Table.Cell>{row.title}</Table.Cell>
        <Table.Cell align="end">{row.views}</Table.Cell>
      </Table.Row>
    ))}
  </Table.Body>
</Table.Root>
```

## Variants and sizes

| Size | Row height | Inline padding | When to use |
|---|---|---|---|
| `md` | `sizing.control.md` | `spacing.inset-control` | Comfortable density: the default, web account pages. |
| `sm` | `sizing.control.sm` | `spacing.inset-control` | Studio under compact spacing and small sizing; dense lists. |

The density comes from the sets, not from a prop of its own: under `spacing: compact` and `sizing: small` the same `size` steps get smaller values, and cell padding follows `inset-control`. A table never invents a third row height.

| Part | Roles |
|---|---|
| `Table.Head` | `fg-muted`, `label`; ground `surface` when sticky |
| `Table.Row` | bottom `border.divider` in `border`; hover `tint`; selected `accent-soft` |
| `Table.Cell` | `fg`, `body-sm`; numbers in `mono` with `tabular-nums` through `className` |
| `Table.Footer` | top divider in `border-strong`, `surface` ground |

## States

| State | What changes |
|---|---|
| Rest | Rows on `bg`, divided by `border`. |
| Row hover | `tint` ground over `motion.duration.fast`, only when the row is interactive (`onClick` or a link inside). |
| Row selected | `accent-soft` ground; `aria-selected` set; never colour alone because the first cell holds a checked checkbox. |
| Focus-visible | `focus-ring` on the focused control inside a cell, or on an interactive row (`tabIndex=0`), `border.focus` wide with `border.focus-offset`, drawn inset. |
| Sticky header | `position: sticky` at the block start of the scroll container, `surface` ground, a `border-strong` divider and shadow elevation 1 once content scrolls under it. |
| Sorted column | The caller's button and `aria-sort`; the head's text becomes `fg`. |
| Empty | The caller renders one `Table.Row` with a full-span `Table.Cell` (an empty-state component); the table adds nothing. |
| Loading | The caller renders [skeleton](skeleton.md) rows of the same `size`; the layout does not move. |
| Disabled, invalid | Not applicable. |

## Tokens

- Colour roles `bg`, `surface`, `tint`, `accent-soft`, `border`, `border-strong`, `fg`, `fg-muted`, `focus-ring`.
- `sizing`: `control` sm, md (row height). `spacing`: `inset-control` (cell inline padding), `gap-inline` (inside a cell), `gutter-compact` (caption spacing).
- `border`: `divider`, `focus`, `focus-offset`. `shadow`: elevation 1 for the sticky header. `radius`: none on the table itself; a wrapping card supplies `card`.
- Type `label` (head), `body-sm` (cell), `caption` (caption and footer), `mono` for figures. `motion`: `fast`, easing `standard`.

## Accessibility

- Native `table`, `thead`, `tbody`, `tfoot`, `th` and `td`, so the browser gives the roles. Every table has a `Table.Caption` (hide it with [visually-hidden](visually-hidden.md) if the design has none) or an `aria-label`.
- `Table.Head` renders `scope="col"` by default; a row header is `Table.Cell asChild` over a `th scope="row"`.
- Sort state is the caller's `aria-sort` on the `th`; the control inside it is a real button.
- Selection is `aria-selected` on the row plus a labelled checkbox; a select-all checkbox in the header is `indeterminate` when partly selected.
- The scroll container is focusable (`tabIndex=0`) with a name when it can overflow, so keyboard users can scroll it.
- Sticky headers keep their cells' widths; the header and body columns stay aligned.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Table.Row` (a router link row), `Table.Head` and `Table.Cell`.
- `useTable()` returns `{ size, stickyHeader }`, so a part written in an app (a sortable head, a row with a menu) can read it.
- `tableStyles`, the `tv()` definition, is exported: `tv({ extend: tableStyles, variants: { ... } })` adds an app-local variant such as a striped body.

## Do and don't

- Do keep sort, selection and paging state in the caller or the app's `DataTable`.
- Do right-align numbers with `align="end"` and use `mono` with `tabular-nums`.
- Do give every table a caption.
- Don't use a table for layout; use a grid.
- Don't put interactive content in a `Table.Row` that is itself clickable without a keyboard path (a link or button in the row).
- Don't set row heights in pixels; use `size`.

## In the workbench

Stories: default, `size` md and sm, sticky header in a scroll container, sortable heads with `aria-sort`, selectable rows with a select-all, selected row, interactive row, numbers aligned to the end, footer with totals, empty and loading rows. Axes: themes by modes, compact density (spacing compact with sizing small), RTL (alignment and sort affordance), more contrast, 320 px width scrolling inside the container.
