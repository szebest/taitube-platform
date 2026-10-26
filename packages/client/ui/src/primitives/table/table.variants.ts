import { tv } from '../../lib/class-names';
import type { TableAlign, TableSize } from './types';

export const tableStyles = tv({
  slots: {
    scroller: 'tw:w-full tw:overflow-auto tw:focus-ring',
    root: 'tw:w-full tw:border-collapse tw:font-sans tw:text-fg',
    caption: 'tw:px-inset-control tw:py-inline tw:text-start tw:text-caption tw:text-fg-muted',
    header: '',
    body: '',
    row: 'tw:border-b-divider tw:border-border tw:transition-colors tw:duration-fast tw:data-[selected=true]:bg-accent-soft tw:motion-reduce:transition-none tw:[&[tabindex]]:hover:bg-tint tw:[&[tabindex]]:focus-ring',
    head: 'tw:px-inset-control tw:text-label tw:font-semibold tw:text-fg-muted tw:aria-[sort]:text-fg',
    cell: 'tw:px-inset-control tw:text-body-sm tw:text-fg',
    footer: 'tw:border-t-divider tw:border-border-strong tw:bg-surface tw:text-caption',
  },
  variants: {
    size: {
      sm: { head: 'tw:h-control-sm', cell: 'tw:h-control-sm' },
      md: { head: 'tw:h-control-md', cell: 'tw:h-control-md' },
    } satisfies Record<TableSize, object>,
    stickyHeader: {
      true: {
        scroller: 'tw:overflow-visible',
        head: 'tw:sticky tw:top-0 tw:z-sticky tw:border-b-divider tw:border-border-strong tw:bg-surface tw:shadow-1',
      },
      false: {},
    },
    align: {
      start: { head: 'tw:text-start', cell: 'tw:text-start' },
      center: { head: 'tw:text-center', cell: 'tw:text-center' },
      end: { head: 'tw:text-end', cell: 'tw:text-end' },
    } satisfies Record<TableAlign, object>,
  },
  defaultVariants: { size: 'md', stickyHeader: false, align: 'start' },
});
