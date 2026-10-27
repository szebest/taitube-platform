import { FlexRender, type Header, type RowData, type SortDirection } from '@tanstack/react-table';
import { Button, Checkbox, Icon, Table, useUiCopy, VisuallyHidden } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { columnLook, useDataTable } from './data-table.context';
import { dataTableStyles } from './data-table.variants';
import type { DataTableFeatures, DataTableSort } from './types';

const SORTS: Readonly<Record<SortDirection, DataTableSort>> = {
  asc: 'ascending',
  desc: 'descending',
};

const SORT_COPY = {
  ascending: 'sortedAscending',
  descending: 'sortedDescending',
  none: 'notSorted',
} as const satisfies Record<DataTableSort, string>;

function SelectAllHead({ rowSpan }: { rowSpan: number }) {
  const { table } = useDataTable('Header');
  const { selectAllRows } = useUiCopy();
  const all = table.getIsAllPageRowsSelected();
  const some = table.getIsSomePageRowsSelected();

  return (
    <Table.Head rowSpan={rowSpan} className={dataTableStyles({ sticky: 'select' }).head()}>
      <Checkbox
        aria-label={selectAllRows}
        checked={all || (some ? 'indeterminate' : false)}
        onCheckedChange={() => table.toggleAllPageRowsSelected(!all)}
      />
    </Table.Head>
  );
}

function SortableHead<TData extends RowData>({
  header,
  index,
}: {
  header: Header<DataTableFeatures, TData>;
  index: number;
}) {
  const { selectable } = useDataTable('Header');
  const copy = useUiCopy();
  const { column } = header;
  const look = columnLook(column.columnDef.meta, index, selectable);
  const direction = column.getIsSorted();
  const sort = direction === false ? 'none' : SORTS[direction];
  const styles = dataTableStyles({ sticky: look.sticky });
  const content = header.isPlaceholder ? null : <FlexRender header={header} />;

  return (
    <Table.Head
      colSpan={header.colSpan}
      align={look.align}
      aria-sort={sort === 'none' ? undefined : sort}
      style={{ width: column.columnDef.meta?.width }}
      className={styles.head()}
    >
      {column.getCanSort() ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={column.getToggleSortingHandler()}
          className={styles.sortButton()}
        >
          {content} <VisuallyHidden>{copy[SORT_COPY[sort]]}</VisuallyHidden>
          <Icon name="chevron-down" size="sm" data-sort={sort} className={styles.sortIcon()} />
        </Button>
      ) : (
        content
      )}
    </Table.Head>
  );
}

/** The column heads, a sort button in each sortable one, and the accent strip while refetching. */
export function DataTableHeader(props: ComponentPropsWithRef<'thead'>) {
  const { table, selectable, fetching } = useDataTable('Header');
  const groups = table.getHeaderGroups();
  const span = table.getAllLeafColumns().length + (selectable ? 1 : 0);

  return (
    <Table.Header {...props}>
      {groups.map((group, row) => (
        <Table.Row key={group.id}>
          {selectable && row === 0 && <SelectAllHead rowSpan={groups.length} />}
          {group.headers.map((header) => (
            <SortableHead key={header.id} header={header} index={header.index} />
          ))}
        </Table.Row>
      ))}
      {fetching && (
        <Table.Row aria-hidden="true" data-slot="data-table-fetching" className="tw:border-b-0">
          <Table.Cell colSpan={span} className={dataTableStyles().strip()} />
        </Table.Row>
      )}
    </Table.Header>
  );
}
