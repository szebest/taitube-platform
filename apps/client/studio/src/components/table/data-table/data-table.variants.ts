import { tv } from '@vp/ui';

export const dataTableStyles = tv({
  slots: {
    root: 'tw:grid tw:grid-cols-[minmax(0,1fr)] tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:text-fg tw:max-expanded:[&_[data-slot=table-scroller]]:overflow-x-auto',
    bar: 'tw:col-start-1 tw:row-start-1 tw:flex tw:min-h-control-lg tw:items-center tw:gap-inline tw:px-inset-control tw:py-inline tw:transition-[opacity,visibility] tw:duration-fast tw:ease-standard',
    batchCount: 'tw:me-auto tw:text-label tw:text-fg',
    strip: 'tw:h-(--border-focus) tw:bg-accent tw:p-0',
    sortButton: 'tw:group/sort tw:-ms-inline tw:gap-inline',
    sortIcon:
      'tw:transition-[rotate,opacity] tw:duration-fast tw:ease-standard tw:data-[sort=ascending]:rotate-180 tw:data-[sort=none]:text-fg-subtle tw:data-[sort=none]:opacity-0 tw:group-hover/sort:opacity-100 tw:group-focus-visible/sort:opacity-100',
    row: 'tw:group/row',
    head: '',
    cell: 'tw:h-control-lg',
    message: 'tw:p-inset-card',
    footer:
      'tw:flex tw:min-h-control-lg tw:flex-wrap tw:items-center tw:gap-inline tw:border-t-divider tw:border-border tw:px-inset-control tw:py-inline tw:text-caption tw:text-fg-muted',
    range: 'tw:me-auto tw:tabular-nums',
    pageOf: 'tw:tabular-nums',
  },
  variants: {
    open: {
      true: { bar: 'tw:opacity-100' },
      false: { bar: 'tw:pointer-events-none tw:invisible tw:opacity-0' },
    },
    numeric: {
      true: { cell: 'tw:tabular-nums' },
      false: {},
    },
    sticky: {
      none: {},
      select: {
        head: 'tw:sticky tw:start-0 tw:w-control-lg tw:bg-surface',
        cell: 'tw:sticky tw:start-0 tw:w-control-lg',
      },
      first: {
        head: 'tw:sticky tw:start-0 tw:bg-surface',
        cell: 'tw:sticky tw:start-0',
      },
      afterSelect: {
        head: 'tw:sticky tw:start-control-lg tw:bg-surface',
        cell: 'tw:sticky tw:start-control-lg',
      },
    },
  },
  compoundSlots: [
    {
      slots: ['cell'],
      sticky: ['select', 'first', 'afterSelect'],
      className:
        'tw:bg-surface tw:group-hover/row:bg-linear-to-r tw:group-hover/row:from-tint tw:group-hover/row:to-tint tw:group-data-[selected=true]/row:bg-linear-to-r tw:group-data-[selected=true]/row:from-accent-soft tw:group-data-[selected=true]/row:to-accent-soft',
    },
  ],
  defaultVariants: { open: true, numeric: false, sticky: 'none' },
});
