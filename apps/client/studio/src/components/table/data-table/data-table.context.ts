import {
  createPaginatedRowModel,
  type RowData,
  createSortedRowModel,
  metaHelper,
  type PaginationState,
  type RowSelectionState,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';
import { createCompoundContext } from '@vp/ui';
import type { DataTableColumnMeta, DataTableInstance, DataTableState } from './types';

/**
 * The features every studio table registers: build the table with these, `manualSorting` and
 * `manualPagination` for server data; the client row models only run for a table that leaves them off.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

/**
 * TanStack types a table's rows invariantly, so no table widens to another row type. The parts read
 * cells and state, never a row's own data, so they hold any table as a table of `RowData`.
 */
export function rowAgnostic<TData extends RowData>(
  table: DataTableInstance<TData>
): DataTableInstance<RowData>;
export function rowAgnostic<TData extends RowData>(
  table: DataTableInstance<TData> | DataTableInstance<RowData>
) {
  return table;
}

export const [DataTableContext, useDataTable] = createCompoundContext<{
  table: DataTableInstance<RowData>;
  selectable: boolean;
  state: DataTableState;
  fetching: boolean;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  pagination: PaginationState;
}>('DataTable');

/** How a column's cells sit: alignment and figures from its meta, the first one held at the inline start. */
export function columnLook(
  meta: DataTableColumnMeta | undefined,
  index: number,
  selectable: boolean
) {
  const sticky = selectable ? 'afterSelect' : 'first';
  return {
    align: meta?.align ?? (meta?.numeric ? 'end' : undefined),
    numeric: meta?.numeric ?? false,
    sticky: index === 0 ? sticky : 'none',
  } as const;
}
