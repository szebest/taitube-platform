import { tv } from '@vp/ui';

export const dataTableStyles = tv({
  slots: {
    root: 'grid grid-cols-[minmax(0,1fr)] rounded-card border-divider border-border bg-surface text-fg max-expanded:[&_[data-slot=table-scroller]]:overflow-x-auto',
    bar: 'col-start-1 row-start-1 flex min-h-control-lg items-center gap-inline px-inset-control py-inline transition-[opacity,visibility] duration-fast ease-standard',
    batchCount: 'me-auto text-label text-fg',
    strip: 'h-(--border-focus) bg-accent p-0',
    sortButton: 'group/sort -ms-inline gap-inline',
    sortIcon:
      'transition-[rotate,opacity] duration-fast ease-standard data-[sort=ascending]:rotate-180 data-[sort=none]:text-fg-subtle data-[sort=none]:opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100',
    row: 'group/row',
    head: '',
    cell: 'h-control-lg',
    message: 'p-inset-card',
    footer:
      'flex min-h-control-lg flex-wrap items-center gap-inline border-t-divider border-border px-inset-control py-inline text-caption text-fg-muted',
    range: 'me-auto tabular-nums',
    pageOf: 'tabular-nums',
  },
  variants: {
    open: {
      true: { bar: 'opacity-100' },
      false: { bar: 'pointer-events-none invisible opacity-0' },
    },
    numeric: {
      true: { cell: 'tabular-nums' },
      false: {},
    },
    sticky: {
      none: {},
      select: {
        head: 'sticky start-0 w-control-lg bg-surface',
        cell: 'sticky start-0 w-control-lg',
      },
      first: {
        head: 'sticky start-0 bg-surface',
        cell: 'sticky start-0',
      },
      afterSelect: {
        head: 'sticky start-control-lg bg-surface',
        cell: 'sticky start-control-lg',
      },
    },
  },
  compoundSlots: [
    {
      slots: ['cell'],
      sticky: ['select', 'first', 'afterSelect'],
      className:
        'bg-surface group-hover/row:bg-linear-to-r group-hover/row:from-tint group-hover/row:to-tint group-data-[selected=true]/row:bg-linear-to-r group-data-[selected=true]/row:from-accent-soft group-data-[selected=true]/row:to-accent-soft',
    },
  ],
  defaultVariants: { open: true, numeric: false, sticky: 'none' },
});
