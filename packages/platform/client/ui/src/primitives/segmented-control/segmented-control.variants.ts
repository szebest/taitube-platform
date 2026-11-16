import { tv } from '../../lib/class-names';
import { slidingIndicatorBase } from '../../lib/sliding-indicator';
import type { SegmentedSize, SegmentedTone } from './types';

export const segmentedControlStyles = tv({
  slots: {
    root: 'relative inline-flex items-stretch gap-0.5 rounded-control bg-tint p-0.5 font-sans',
    item: 'inline-flex cursor-pointer items-center justify-center gap-inline rounded-control border-0 bg-transparent px-inset-control text-label whitespace-nowrap text-fg-muted transition-colors duration-fast touch-target focus-ring hover:text-fg active:scale-97 disabled:cursor-not-allowed disabled:text-fg-subtle disabled:hover:text-fg-subtle disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-icon-sm',
    indicator: `${slidingIndicatorBase} h-(--indicator-height) w-(--indicator-width) translate-x-(--indicator-x) translate-y-(--indicator-y) rounded-control`,
  },
  variants: {
    tone: {
      neutral: {
        item: 'not-in-data-[indicator=shown]:data-[state=checked]:bg-surface not-in-data-[indicator=shown]:data-[state=checked]:shadow-1 data-[state=checked]:text-fg',
        indicator: 'bg-surface shadow-1',
      },
      accent: {
        item: 'not-in-data-[indicator=shown]:data-[state=checked]:bg-accent data-[state=checked]:text-on-accent data-[state=checked]:hover:text-on-accent',
        indicator: 'bg-accent',
      },
    } satisfies Record<SegmentedTone, object>,
    size: {
      sm: { root: 'h-control-sm' },
      md: { root: 'h-control-md' },
      lg: { root: 'h-control-lg' },
    } satisfies Record<SegmentedSize, object>,
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});
