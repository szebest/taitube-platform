# DataTable

The studio's table: the `Table` primitive from `@vp/ui` ([primitives/table.md](../../primitives/table.md), parts and styling only) wired to TanStack Table state, with a batch bar, sortable headers, row selection and a paginated footer. It lives in the studio's kit, `apps/client/studio/src/components/table/data-table/` ([README](README.md)). The primitive draws; `DataTable` owns the behaviour (sorting, selection and pagination wiring, keyboard model) and nothing about which table it is.

## Anatomy

```
┌────────────────────────────────────────────────────────────────────┐
│ 1 3 selected   [Set visibility v] [Delete]                          │
├───┬──────────────────────────┬───────────┬──────────┬───────┬──────┤
│[ ]│ 2 Title            v     │ Status    │ Views v  │ Date  │  ... │
├───┼──────────────────────────┼───────────┼──────────┼───────┼──────┤
│[x]│ ▢ Shot entirely on...    │ [READY]   │ 412,008  │ 2 d   │  ... │
│[ ]│ ▢ Night bus to Porto     │ [PROCESS.]│ 0        │ 1 h   │  ... │
├───┴──────────────────────────┴───────────┴──────────┴───────┴──────┤
│ 3 1 to 20 of 142                          [<]  Page 1 of 8  [>]     │
└────────────────────────────────────────────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Batch bar | replaces the header when rows are selected |
| 2 | Header cell | a `Table` head cell with a sort button, `caption` type at weight 650, `fg-muted`, sort icon and `aria-sort` |
| 3 | Footer | range text and page controls; both strings are the app's |
| body | Rows | a `Table` row at `control.lg` height, `border` bottom at the divider width, hover `tint` |

## Props

Plus the standard props. The caller builds the TanStack `table` instance (columns, `manualSorting`, `manualPagination`, `getRowId`, state controlled by the route's search params) and passes it in; the parts read it from context.

```ts
// types.ts
import type { Table } from '@tanstack/react-table';
import type { Align } from '@vp/ui';

export type DataTableState = 'ready' | 'loading' | 'empty' | 'error';
export type DataTableSort = 'ascending' | 'descending' | 'none';
export type DataTableColumnAlign = Align;

export interface DataTableColumnMeta {
  width?: string;                  // a CSS length or percentage, also read by the skeleton
  align?: DataTableColumnAlign;    // numbers use 'end'
  numeric?: boolean;               // tabular-nums
}

export type DataTableInstance<TData> = Table<TData>;
```

```ts
interface DataTableRootProps<TData> {
  table: DataTableInstance<TData>;
  state?: DataTableState;          // default 'ready'
  stickyHeader?: boolean;          // default true
  fetching?: boolean;              // a refetch with rows kept: the accent strip and aria-busy
}
// Parts: DataTable.Root, .Toolbar, .Batch, .Header, .Body, .Pagination, .Range
```

```tsx
<DataTable.Root table={table} state={state} fetching={isFetching}>
  <DataTable.Toolbar><Input placeholder="Filter by title" /></DataTable.Toolbar>
  <DataTable.Batch><Button>Delete</Button></DataTable.Batch>
  <DataTable.Header />
  <DataTable.Body />
  <DataTable.Pagination><DataTable.Range>1 to 20 of 142</DataTable.Range></DataTable.Pagination>
</DataTable.Root>
```

What each part owns, over the `Table` primitive's `Table.Root`, `Header`, `Body`, `Row`, `Head`, `Cell` and `Footer` parts:

- **`Header`** renders `table.getHeaderGroups()` with `flexRender`; a sortable column gets a sort button wired to `column.getToggleSortingHandler()`, `aria-sort` from `column.getIsSorted()` mapped to `DataTableSort`, and the faint-arrow-on-hover rule. The selection column's head is a `Checkbox` bound to `table.getToggleAllRowsSelectedHandler()` with the tri-state from `getIsSomeRowsSelected()`.
- **`Body`** renders `table.getRowModel().rows`; each row's `Checkbox` is `row.getToggleSelectedHandler()`, `aria-selected` from `row.getIsSelected()`; it renders the skeleton rows for `state="loading"` and the caller's `EmptyState` or `SectionError` child for `empty` and `error`, with the header kept.
- **`Pagination`** reads `table.getState().pagination` and calls `table.previousPage()`, `nextPage()` and `setPageSize()`; the page-size menu, "Page 1 of 8" and the buttons' names come from `useUiCopy()`; the range text is the `Range` child.
- **Selection column and keyboard** (arrow keys between rows, Space, Shift plus Space, Enter) are `DataTable`'s, defined once here so no feature re-implements them.

`state` is one enum; `fetching` is separate because a refetch keeps the rows.

## Smart wrappers

| Wrapper | Folder | Props | Hooks |
|---|---|---|---|
| `LibraryTable` | `features/content/components/` | `onInspect: (videoId: string) => void` | `useSearch` for sort, page and filter (the route's `validateSearch` params), `useSuspenseQuery(myVideosQueryOptions)`, `useReactTable` with `libraryColumns`, `useBatchActions` (delete, set visibility), `useCan`, `useT` |
| `LibraryVideoRow` | `features/content/components/` | `video: CreatorVideo`, `onInspect: (videoId: string) => void` | `useFormat` (views, date, duration), `useT` (status and visibility labels), `useCan` (edit, delete in the row menu), `useVideoActions` |
| `CategoryTable` | `features/admin/components/` | none | `useSearch`, `useSuspenseQuery`, `useReactTable`, `useCan`, `useT` |

`LibraryTable` fixes the columns (title with thumbnail, status, visibility, date, views, likes, comments, menu), the default sort and the batch actions; the route renders `<LibraryTable onInspect={open} />`. `LibraryVideoRow` draws one video's cells: a [VideoThumbnail](../../components/video-thumbnail.md) at `layout.row-thumb` in the first cell, the status `Badge` with its icon from `VideoStatus`, the visibility from `VideoVisibility`, and the formatted metrics; it collapses to the stacked card at compact. Sort, page and filter live in the URL, so the table view is a shareable link.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| A different header or cell | the column definition's `header` and `cell` render functions, which `flexRender` calls; no change to `DataTable` |
| A different body (virtualised rows) | compose `Table` parts yourself inside `DataTable.Root` and read `useDataTable()` for the `table` and `state` |
| A custom action in the batch bar | any element inside `DataTable.Batch` |
| An app-local look | `tv({ extend: dataTableStyles, variants: { ... } })` |

## Variants

Density is the `spacing` and `sizing` sets, not a prop. At the studio's `compact` and `small` defaults rows are `control.lg` high with `inset-control` cell padding; at `default` and `medium` they grow with the sets.

| Condition | Difference |
|---|---|
| selection column | present when the table has `enableRowSelection` |
| sortable column | a column with `enableSorting` shows a sort button |

## States

| State | What changes |
|---|---|
| rest | as drawn |
| row hover | `tint` ground, row actions fully visible |
| row selected | `accent-soft` ground, checkbox checked, batch bar shown |
| sorted | `aria-sort`, an arrow icon in `fg`, other columns show a faint arrow on hover only |
| `loading` | `DataTableSkeleton` rows below the real header |
| `empty` | the empty child, header kept |
| `error` | the error child, header kept |
| `fetching` | a strip under the header at `border.focus` height in `accent`, rows stay, `aria-busy` |
| status badges | `Badge`s with their status icon, never colour alone |

## Skeleton

`DataTableSkeleton`: header row at the real header's height, ten body rows at the row height of the active sizing set, cell bars at the `width` each column declares in its `meta`, footer at `control.lg` plus `inset-control`. It takes the same `table` columns as the loaded table, so the widths cannot drift.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | each row becomes a stacked card: thumbnail, title, status, one key metric, a menu; selection by long press |
| medium | the table scrolls horizontally inside its card, first column sticky at the inline start |
| expanded | full table, secondary columns visible |
| large | as expanded |

## Motion

- Row hover ground at `instant`.
- Batch bar replaces the header at `fast`, no slide.
- Sort icon rotates at `fast`.
- Rows never animate on data change, so a refetch does not shimmer the table.
- Reduced motion: no change needed beyond opacity.

## Accessibility

- A real `table` with a visually hidden `caption` and `th scope` (from the `Table` primitive); `aria-sort` on sorted columns, `aria-selected` on selected rows.
- Column sort buttons are inside the `th`, named by the column and the sort state.
- Keyboard: arrow keys move between rows, Space toggles a row checkbox, Shift plus Space extends, Enter opens the inspector; the batch bar's appearance is announced ("3 selected").
- Row action menus use `DropdownMenu`; destructive actions open a confirmation dialog owned by the feature.
- Numbers are `tabular-nums` and aligned at the inline end.

## Composition

`Table` (parts), `Checkbox`, `Badge`, `DropdownMenu`, `Button`, `IconButton`, `Skeleton`, `ScrollArea`, and [EmptyState](../../components/empty-state.md) and [SectionError](../../components/section-error.md) as the caller's children.

## Used by

- [60, creator studio](../../../tickets/60-creator-studio-dashboard-video-management-ui.md): the video library with sort, filter, batch actions, through `LibraryTable`
- [61, admin control panel](../../../tickets/61-admin-control-panel-category-moderation-ui.md): moderation and categories, through `CategoryTable`

## Workbench stories

- Video library at the studio's compact defaults
- Sorted by views descending
- Rows selected with the batch bar
- Status badges in each state
- Loading, empty, error
- Fetching
- Compact stacked cards
- Horizontal scroll with sticky first column
- RTL
