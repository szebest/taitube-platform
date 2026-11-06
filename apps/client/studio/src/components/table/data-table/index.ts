import { DataTableBody } from './components/data-table-body/data-table-body';
import { DataTableHeader } from './components/data-table-header/data-table-header';
import { DataTablePagination } from './components/data-table-pagination/data-table-pagination';
import {
  DataTableBatch,
  DataTableCaption,
  DataTableRange,
  DataTableRoot,
  DataTableToolbar,
} from './data-table';

export const DataTable = {
  Root: DataTableRoot,
  Caption: DataTableCaption,
  Toolbar: DataTableToolbar,
  Batch: DataTableBatch,
  Header: DataTableHeader,
  Body: DataTableBody,
  Pagination: DataTablePagination,
  Range: DataTableRange,
};
export { dataTableFeatures, useDataTable } from './data-table.context';
export { dataTableStyles } from './data-table.variants';
export type { DataTableSkeletonProps } from './components/data-table-skeleton/data-table-skeleton';
export { DataTableSkeleton } from './components/data-table-skeleton/data-table-skeleton';
export type { DataTableColumnMeta, DataTableFeatures } from './types';
