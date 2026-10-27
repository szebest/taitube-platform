import type { RowData, Table } from '@tanstack/react-table';
import type { Align } from '@vp/ui';
import type { dataTableFeatures } from './data-table.context';

export type DataTableState = 'ready' | 'loading' | 'empty' | 'error';
export type DataTableSort = 'ascending' | 'descending' | 'none';
type DataTableColumnAlign = Align;

export interface DataTableColumnMeta {
  /** A CSS length or percentage; the skeleton reads it too, so its bars cannot drift. */
  width?: string;
  align?: DataTableColumnAlign;
  /** Tabular figures, aligned at the inline end unless `align` says otherwise. */
  numeric?: boolean;
}

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableInstance<TData extends RowData> = Table<DataTableFeatures, TData>;
