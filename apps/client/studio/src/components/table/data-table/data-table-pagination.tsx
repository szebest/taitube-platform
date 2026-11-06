import { Button, DropdownMenu, Icon, IconButton, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';
import { useDataTable } from './data-table.context';
import { dataTableStyles } from './data-table.variants';

const PAGE_SIZES = [10, 20, 50, 100] as const;

export interface DataTablePaginationProps extends ComponentPropsWithRef<'div'> {
  pageSizes?: readonly number[];
}

/** The footer: the caller's `Range` at the start, then the page size menu and the page controls. */
export function DataTablePagination({
  pageSizes = PAGE_SIZES,
  className,
  children,
  ...props
}: DataTablePaginationProps) {
  const { table, pagination } = useDataTable('Pagination');
  const copy = useUiCopy();
  const id = useId();
  const styles = dataTableStyles();
  const pageOf = copy.pageOf
    .replace('{position}', String(pagination.pageIndex + 1))
    .replace('{count}', String(Math.max(table.getPageCount(), 1)));

  return (
    <div data-slot="data-table-pagination" className={styles.footer({ className })} {...props}>
      {children}
      <span id={`${id}-size`}>{copy.rowsPerPage}</span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            id={`${id}-trigger`}
            variant="ghost"
            size="sm"
            aria-labelledby={`${id}-size ${id}-trigger`}
          >
            {pagination.pageSize}
            <Icon name="chevron-down" size="sm" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content size="sm" align="end">
          <DropdownMenu.RadioGroup
            value={String(pagination.pageSize)}
            onValueChange={(size) => table.setPageSize(Number(size))}
          >
            {pageSizes.map((size) => (
              <DropdownMenu.RadioItem key={size} value={String(size)}>
                {size}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <IconButton
        size="sm"
        aria-label={copy.previousPage}
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        <Icon name="chevron-left" />
      </IconButton>
      <span className={styles.pageOf()}>{pageOf}</span>
      <IconButton
        size="sm"
        aria-label={copy.nextPage}
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        <Icon name="chevron-right" />
      </IconButton>
    </div>
  );
}
