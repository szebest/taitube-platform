import { tv } from '../../lib/class-names';
import type { TableAlign, TableSize } from './types';

export const tableStyles = tv({
  slots: {
    scroller: 'w-full overflow-auto focus-ring',
    root: 'w-full border-collapse font-sans text-fg',
    caption: 'px-inset-control py-inline text-start text-caption text-fg-muted',
    header: '',
    body: '',
    row: 'border-b-divider border-border transition-colors duration-fast data-[selected=true]:bg-accent-soft motion-reduce:transition-none [&[tabindex]]:hover:bg-tint [&[tabindex]]:focus-ring',
    head: 'px-inset-control text-label text-fg-muted aria-[sort]:text-fg',
    cell: 'px-inset-control text-body-sm text-fg select-text',
    footer: 'border-t-divider border-border-strong bg-surface text-caption',
  },
  variants: {
    size: {
      sm: { head: 'h-control-sm', cell: 'h-control-sm' },
      md: { head: 'h-control-md', cell: 'h-control-md' },
    } satisfies Record<TableSize, object>,
    stickyHeader: {
      true: {
        scroller: 'overflow-visible',
        head: 'sticky top-0 z-sticky border-b-divider border-border-strong bg-surface shadow-1',
      },
      false: {},
    },
    align: {
      start: { head: 'text-start', cell: 'text-start' },
      center: { head: 'text-center', cell: 'text-center' },
      end: { head: 'text-end', cell: 'text-end' },
    } satisfies Record<TableAlign, object>,
  },
  defaultVariants: { size: 'md', stickyHeader: false, align: 'start' },
});
