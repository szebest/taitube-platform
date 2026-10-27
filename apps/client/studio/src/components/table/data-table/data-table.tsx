import { type RowData, Subscribe, type TableState } from '@tanstack/react-table';
import { Table, useUiCopy, VisuallyHidden } from '@vp/ui';
import {
  Children,
  type ComponentPropsWithRef,
  type ComponentType,
  isValidElement,
  type ReactNode,
} from 'react';
import { DataTableContext, rowAgnostic, useDataTable } from './data-table.context';
import { DataTablePagination } from './data-table-pagination';
import { dataTableStyles } from './data-table.variants';
import type { DataTableFeatures, DataTableInstance, DataTableState } from './types';

export interface DataTableRootProps<TData extends RowData> extends ComponentPropsWithRef<'div'> {
  table: DataTableInstance<TData>;
  state?: DataTableState;
  stickyHeader?: boolean;
  /** A refetch that keeps the rows: the accent strip under the header and `aria-busy`. */
  fetching?: boolean;
}

const slicesOf = ({ sorting, rowSelection, pagination }: TableState<DataTableFeatures>) => ({
  sorting,
  rowSelection,
  pagination,
});

const isPart = (node: ReactNode, ...parts: ComponentType<never>[]) =>
  isValidElement(node) && parts.some((part) => node.type === part);

/**
 * The card around a TanStack table: the toolbar or batch bar above, the `table` with every other
 * child inside it, the pagination below. The caller builds the table; the parts read it from here.
 */
export function DataTableRoot<TData extends RowData>({
  table,
  state = 'ready',
  stickyHeader = true,
  fetching = false,
  className,
  children,
  ...props
}: DataTableRootProps<TData>) {
  const nodes = Children.toArray(children);
  const bars = nodes.filter((node) => isPart(node, DataTableToolbar, DataTableBatch));
  const footers = nodes.filter((node) => isPart(node, DataTablePagination));
  const sections = nodes.filter((node) => !(bars.includes(node) || footers.includes(node)));
  const selectable = table.options.enableRowSelection !== false;

  return (
    <Subscribe source={table.store} selector={slicesOf}>
      {(slices) => (
        <DataTableContext
          value={{ table: rowAgnostic(table), selectable, state, fetching, ...slices }}
        >
          <div
            data-slot="data-table"
            data-state={state}
            className={dataTableStyles().root({ className })}
            {...props}
          >
            {bars}
            <Table.Root stickyHeader={stickyHeader} aria-busy={fetching || state === 'loading'}>
              {sections}
            </Table.Root>
            {footers}
          </div>
        </DataTableContext>
      )}
    </Subscribe>
  );
}

/** The table's name for assistive technology; the page heading already shows it. */
export function DataTableCaption({ children, ...props }: ComponentPropsWithRef<'caption'>) {
  return (
    <Table.Caption {...props}>
      <VisuallyHidden>{children}</VisuallyHidden>
    </Table.Caption>
  );
}

const selectedCount = (selection: Record<string, boolean>) =>
  Object.values(selection).filter(Boolean).length;

/** Filters and view controls; the batch bar takes its place while rows are selected. */
export function DataTableToolbar({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { rowSelection } = useDataTable('Toolbar');
  const open = selectedCount(rowSelection) === 0;

  return (
    <div
      data-slot="data-table-toolbar"
      inert={!open}
      className={dataTableStyles({ open }).bar({ className })}
      {...props}
    />
  );
}

/** Actions on the selected rows, shown over the toolbar with the count, which is announced. */
export function DataTableBatch({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const { rowSelection } = useDataTable('Batch');
  const copy = useUiCopy();
  const count = selectedCount(rowSelection);
  const open = count > 0;
  const label = copy.selectedCount.replace('{count}', String(count));
  const styles = dataTableStyles({ open });

  return (
    <>
      <VisuallyHidden role="status">{open ? label : ''}</VisuallyHidden>
      <div
        data-slot="data-table-batch"
        data-state={open ? 'open' : 'closed'}
        inert={!open}
        className={styles.bar({ className: ['tw:bg-accent-soft', className] })}
        {...props}
      >
        <span aria-hidden="true" className={styles.batchCount()}>
          {label}
        </span>
        {children}
      </div>
    </>
  );
}

/** "1 to 20 of 142": the app formats it, so the numbers follow the viewer's locale. */
export function DataTableRange({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="data-table-range"
      className={dataTableStyles().range({ className })}
      {...props}
    />
  );
}
