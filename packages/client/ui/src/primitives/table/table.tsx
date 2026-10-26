import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { TableContext, useTable } from './table.context';
import { tableStyles } from './table.variants';
import type { TableAlign, TableSize } from './types';

export interface TableRootProps extends ComponentPropsWithRef<'table'> {
  size?: TableSize;
  stickyHeader?: boolean;
}

/** A scroll container around the `table`, so a wide one scrolls inside the page. It never sorts, selects or pages. */
export function TableRoot({
  size = 'md',
  stickyHeader = false,
  className,
  ...props
}: TableRootProps) {
  const shared = useMemo(() => ({ size, stickyHeader }), [size, stickyHeader]);
  const styles = tableStyles(shared);

  return (
    <TableContext value={shared}>
      <div data-slot="table-scroller" className={styles.scroller()}>
        <table data-slot="table" className={styles.root({ className })} {...props} />
      </div>
    </TableContext>
  );
}

export function TableCaption({ className, ...props }: ComponentPropsWithRef<'caption'>) {
  const shared = useTable('Caption');

  return (
    <caption
      data-slot="table-caption"
      className={tableStyles(shared).caption({ className })}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: ComponentPropsWithRef<'thead'>) {
  const shared = useTable('Header');

  return (
    <thead
      data-slot="table-header"
      className={tableStyles(shared).header({ className })}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentPropsWithRef<'tbody'>) {
  const shared = useTable('Body');

  return (
    <tbody data-slot="table-body" className={tableStyles(shared).body({ className })} {...props} />
  );
}

export function TableFooter({ className, ...props }: ComponentPropsWithRef<'tfoot'>) {
  const shared = useTable('Footer');

  return (
    <tfoot
      data-slot="table-footer"
      className={tableStyles(shared).footer({ className })}
      {...props}
    />
  );
}

export interface TableRowProps extends ComponentPropsWithRef<'tr'> {
  selected?: boolean;
  asChild?: boolean;
}

export function TableRow({ selected, asChild = false, className, ...props }: TableRowProps) {
  const shared = useTable('Row');
  const Element = asChild ? Slot.Root : 'tr';

  return (
    <Element
      data-slot="table-row"
      data-selected={selected}
      aria-selected={selected}
      className={tableStyles(shared).row({ className })}
      {...props}
    />
  );
}

export interface TableHeadProps extends Omit<ComponentPropsWithRef<'th'>, 'align'> {
  align?: TableAlign;
  asChild?: boolean;
}

export function TableHead({
  align,
  asChild = false,
  scope = 'col',
  className,
  ...props
}: TableHeadProps) {
  const shared = useTable('Head');
  const Element = asChild ? Slot.Root : 'th';

  return (
    <Element
      data-slot="table-head"
      scope={scope}
      className={tableStyles({ ...shared, align }).head({ className })}
      {...props}
    />
  );
}

export interface TableCellProps extends Omit<ComponentPropsWithRef<'td'>, 'align'> {
  align?: TableAlign;
  asChild?: boolean;
}

export function TableCell({ align, asChild = false, className, ...props }: TableCellProps) {
  const shared = useTable('Cell');
  const Element = asChild ? Slot.Root : 'td';

  return (
    <Element
      data-slot="table-cell"
      className={tableStyles({ ...shared, align }).cell({ className })}
      {...props}
    />
  );
}
