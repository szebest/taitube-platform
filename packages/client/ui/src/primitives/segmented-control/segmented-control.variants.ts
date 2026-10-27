import { tv } from '../../lib/class-names';
import { slidingIndicatorBase } from '../../lib/sliding-indicator';
import type { SegmentedSize, SegmentedTone } from './types';

export const segmentedControlStyles = tv({
  slots: {
    root: 'tw:relative tw:inline-flex tw:items-stretch tw:gap-0.5 tw:rounded-control tw:bg-tint tw:p-0.5 tw:font-sans',
    item: 'tw:inline-flex tw:cursor-pointer tw:items-center tw:justify-center tw:gap-inline tw:rounded-control tw:border-0 tw:bg-transparent tw:px-inset-control tw:text-label tw:whitespace-nowrap tw:text-fg-muted tw:transition-colors tw:duration-fast tw:touch-target tw:focus-ring tw:hover:text-fg tw:active:scale-97 tw:disabled:cursor-not-allowed tw:disabled:text-fg-subtle tw:disabled:hover:text-fg-subtle tw:disabled:active:scale-100 tw:motion-reduce:transition-none tw:motion-reduce:active:scale-100 tw:[&_svg]:size-icon-sm',
    indicator: `${slidingIndicatorBase} tw:h-(--indicator-height) tw:w-(--indicator-width) tw:translate-x-(--indicator-x) tw:translate-y-(--indicator-y) tw:rounded-control`,
  },
  variants: {
    tone: {
      neutral: {
        item: 'tw:not-in-data-[indicator=shown]:data-[state=checked]:bg-surface tw:not-in-data-[indicator=shown]:data-[state=checked]:shadow-1 tw:data-[state=checked]:text-fg',
        indicator: 'tw:bg-surface tw:shadow-1',
      },
      accent: {
        item: 'tw:not-in-data-[indicator=shown]:data-[state=checked]:bg-accent tw:data-[state=checked]:text-on-accent tw:data-[state=checked]:hover:text-on-accent',
        indicator: 'tw:bg-accent',
      },
    } satisfies Record<SegmentedTone, object>,
    size: {
      sm: { root: 'tw:h-control-sm' },
      md: { root: 'tw:h-control-md' },
      lg: { root: 'tw:h-control-lg' },
    } satisfies Record<SegmentedSize, object>,
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});
