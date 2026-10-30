import {
  DataTableBatch,
  DataTableCaption,
  DataTableRange,
  DataTableRoot,
  DataTableToolbar,
} from './data-table';
import { DataTableBody } from './data-table-body';
import { DataTableHeader } from './data-table-header';
import { DataTablePagination } from './data-table-pagination';

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
export type { DataTableSkeletonProps } from './data-table-skeleton';
export { DataTableSkeleton } from './data-table-skeleton';
export type { DataTableColumnMeta, DataTableFeatures } from './types';
