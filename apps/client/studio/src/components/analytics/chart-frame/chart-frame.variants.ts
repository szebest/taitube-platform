import { tv } from '@vp/ui';
import type { ChartFrameSize } from './types';

export const chartFrameStyles = tv({
  slots: {
    root: 'tw:m-0 tw:flex tw:min-w-0 tw:flex-col tw:gap-stack tw:font-sans tw:text-fg',
    title: 'tw:m-0 tw:text-title',
    legend:
      'tw:m-0 tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-inline tw:border-0 tw:p-0',
    legendItem:
      'tw:inline-flex tw:min-h-touch-target tw:cursor-pointer tw:items-center tw:gap-inline tw:rounded-control tw:border-0 tw:bg-transparent tw:px-inline tw:font-sans tw:text-body-sm tw:text-fg tw:transition-colors tw:duration-fast tw:ease-standard tw:hover:bg-tint tw:focus-ring tw:aria-pressed:bg-tint-strong tw:data-dimmed:text-fg-muted',
    legendDot: 'tw:size-icon-sm tw:shrink-0',
    plot: 'tw:relative tw:min-w-0 tw:data-placeholder:flex tw:data-placeholder:items-center tw:data-placeholder:justify-center',
    fill: 'tw:h-full tw:w-full',
    gridlines: 'tw:flex tw:flex-col tw:justify-between',
    gridline: 'tw:m-0 tw:border-0 tw:border-t-divider tw:border-border',
  },
  variants: {
    size: {
      sm: { plot: 'tw:h-[12.5rem]' },
      md: { plot: 'tw:h-[15rem]' },
      lg: { plot: 'tw:h-[17.5rem]' },
      xl: { plot: 'tw:h-[20rem]' },
    } satisfies Record<ChartFrameSize, object>,
  },
  defaultVariants: { size: 'md' },
});
