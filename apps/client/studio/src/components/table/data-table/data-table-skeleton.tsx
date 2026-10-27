import { Skeleton, Table } from '@vp/ui';
import { columnLook } from './data-table.context';
import { dataTableStyles } from './data-table.variants';
import type { DataTableColumnMeta } from './types';

const ROWS = Array.from({ length: 10 }, (_, row) => `row-${row}`);

/** A column as the skeleton reads it: any column definition of the table fits. */
interface DataTableSkeletonColumn {
  meta?: DataTableColumnMeta;
}

interface SkeletonRowsProps {
  columns: readonly DataTableSkeletonColumn[];
  selectable: boolean;
}

/** Ten rows of bars at the row height, each cell at its column's declared width. */
export function DataTableSkeletonRows({ columns, selectable }: SkeletonRowsProps) {
  return ROWS.map((row) => (
    <Table.Row key={row} aria-hidden="true" data-slot="data-table-skeleton-row">
      {selectable && (
        <Table.Cell className={dataTableStyles({ sticky: 'select' }).cell()}>
          <Skeleton radius="xs" className="tw:size-icon-sm" />
        </Table.Cell>
      )}
      {columns.map(({ meta }, index) => {
        const look = columnLook(meta, index, selectable);
        return (
          <Table.Cell
            // biome-ignore lint/suspicious/noArrayIndexKey: the columns are fixed for the table's life
            key={index}
            align={look.align}
            style={{ width: meta?.width }}
            className={dataTableStyles({ sticky: look.sticky }).cell()}
          >
            <Skeleton shape="text" className="tw:w-full" />
          </Table.Cell>
        );
      })}
    </Table.Row>
  ));
}

export interface DataTableSkeletonProps {
  columns: readonly DataTableSkeletonColumn[];
  selectable?: boolean;
}

/** The loaded table's frame before its data: the same columns, so the widths cannot drift. */
export function DataTableSkeleton({ columns, selectable = true }: DataTableSkeletonProps) {
  const styles = dataTableStyles();

  return (
    <div data-slot="data-table-skeleton" aria-hidden="true" className={styles.root()}>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            {selectable && <Table.Cell className="tw:w-control-lg" />}
            {columns.map(({ meta }, index) => (
              <Table.Cell
                // biome-ignore lint/suspicious/noArrayIndexKey: the columns are fixed for the table's life
                key={index}
                style={{ width: meta?.width }}
              >
                <Skeleton shape="text" className="tw:w-1/2" />
              </Table.Cell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <DataTableSkeletonRows columns={columns} selectable={selectable} />
        </Table.Body>
      </Table.Root>
      <div className={styles.footer()}>
        <Skeleton shape="text" className="tw:w-1/4" />
      </div>
    </div>
  );
}
