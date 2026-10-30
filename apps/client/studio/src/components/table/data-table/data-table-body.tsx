import { FlexRender, type Row, type RowData } from '@tanstack/react-table';
import { Checkbox, Table, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, type KeyboardEvent, useId, useState } from 'react';
import { columnLook, useDataTable } from './data-table.context';
import { dataTableStyles } from './data-table.variants';
import { DataTableSkeletonRows } from './data-table-skeleton';
import type { DataTableFeatures } from './types';

export interface DataTableBodyProps extends ComponentPropsWithRef<'tbody'> {
  /** Enter on a focused row: the feature opens it, in the inspector for the library. */
  onRowActivate?: (rowId: string) => void;
}

type AnyRow = Row<DataTableFeatures, RowData>;

const toggle = <TData extends RowData>(row: Row<DataTableFeatures, TData>, shiftKey: boolean) =>
  row.getToggleSelectedHandler()({ target: { checked: !row.getIsSelected() }, shiftKey });

const sibling = (row: HTMLElement, key: string) =>
  key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling;

/**
 * The rows, one focusable at a time: arrows move between them, Space selects, Shift and Space
 * extends from the last one selected, Enter activates. Skeleton rows while loading, and the
 * caller's empty or error child across every column when there is nothing to list.
 */
export function DataTableBody({ onRowActivate, children, ...props }: DataTableBodyProps) {
  const { table, selectable, state } = useDataTable('Body');
  const { selectRow } = useUiCopy();
  const id = useId();
  const [focused, setFocused] = useState<string>();
  const columns = table.getAllLeafColumns();

  if (state === 'loading') {
    return (
      <Table.Body {...props}>
        <DataTableSkeletonRows
          columns={columns.map(({ columnDef }) => columnDef)}
          selectable={selectable}
        />
      </Table.Body>
    );
  }

  if (state !== 'ready') {
    return (
      <Table.Body {...props}>
        <Table.Row>
          <Table.Cell
            colSpan={columns.length + (selectable ? 1 : 0)}
            className={dataTableStyles().message()}
          >
            {children}
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    );
  }

  const rows: AnyRow[] = table.getRowModel().rows;
  const current = rows.some((row) => row.id === focused) ? focused : rows[0]?.id;

  const handleKey = (event: KeyboardEvent<HTMLTableRowElement>, row: AnyRow) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = sibling(event.currentTarget, event.key);
      if (next instanceof HTMLElement) next.focus();
      return;
    }
    if (event.key === ' ' && selectable) {
      event.preventDefault();
      toggle(row, event.shiftKey);
    }
    if (event.key === 'Enter') onRowActivate?.(row.id);
  };

  return (
    <Table.Body {...props}>
      {rows.map((row) => {
        const labelId = `${id}-${row.id}`;
        return (
          <Table.Row
            key={row.id}
            selected={row.getIsSelected()}
            tabIndex={row.id === current ? 0 : -1}
            onFocus={() => setFocused(row.id)}
            onKeyDown={(event) => handleKey(event, row)}
            className={dataTableStyles().row()}
          >
            {selectable && (
              <Table.Cell className={dataTableStyles({ sticky: 'select' }).cell()}>
                <Checkbox
                  id={`${labelId}-select`}
                  aria-label={selectRow}
                  aria-labelledby={`${labelId}-select ${labelId}`}
                  tabIndex={-1}
                  checked={row.getIsSelected()}
                  onClick={(event) => toggle(row, event.shiftKey)}
                />
              </Table.Cell>
            )}
            {row.getAllCells().map((cell, index) => {
              const look = columnLook(cell.column.columnDef.meta, index, selectable);
              return (
                <Table.Cell
                  key={cell.id}
                  id={index === 0 ? labelId : undefined}
                  align={look.align}
                  className={dataTableStyles(look).cell()}
                >
                  <FlexRender cell={cell} />
                </Table.Cell>
              );
            })}
          </Table.Row>
        );
      })}
    </Table.Body>
  );
}
