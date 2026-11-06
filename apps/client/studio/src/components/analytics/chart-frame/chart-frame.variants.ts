import { tv } from '@vp/ui';
import type { ChartFrameSize } from './types';

export const chartFrameStyles = tv({
  slots: {
    root: 'm-0 flex min-w-0 flex-col gap-stack font-sans text-fg',
    title: 'm-0 text-title',
    legend: 'm-0 flex min-w-0 flex-wrap items-center gap-inline border-0 p-0',
    legendItem:
      'inline-flex min-h-touch-target cursor-pointer items-center gap-inline rounded-control border-0 bg-transparent px-inline font-sans text-body-sm text-fg transition-colors duration-fast ease-standard hover:bg-tint focus-ring aria-pressed:bg-tint-strong data-dimmed:text-fg-muted',
    legendDot: 'size-icon-sm shrink-0',
    plot: 'relative min-w-0 data-placeholder:flex data-placeholder:items-center data-placeholder:justify-center',
    fill: 'h-full w-full',
    gridlines: 'flex flex-col justify-between',
    gridline: 'm-0 border-0 border-t-divider border-border',
  },
  variants: {
    size: {
      sm: { plot: 'h-[12.5rem]' },
      md: { plot: 'h-[15rem]' },
      lg: { plot: 'h-[17.5rem]' },
      xl: { plot: 'h-[20rem]' },
    } satisfies Record<ChartFrameSize, object>,
  },
  defaultVariants: { size: 'md' },
});
