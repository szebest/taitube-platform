import { tv } from '../../lib/class-names';
import type { KbdFill, KbdSize } from './types';

export const kbdStyles = tv({
  base: 'tw:inline-flex tw:min-w-[calc(1lh+var(--space-1))] tw:items-center tw:justify-center tw:rounded-xs tw:border-control tw:px-1 tw:py-px tw:font-mono tw:tabular-nums tw:in-data-disabled:text-fg-subtle',
  variants: {
    variant: {
      outline: 'tw:border-border-strong tw:text-fg-muted',
      soft: 'tw:border-transparent tw:bg-tint tw:text-fg',
    } satisfies Record<KbdFill, string>,
    size: {
      sm: 'tw:text-caption',
      md: 'tw:text-mono',
    } satisfies Record<KbdSize, string>,
  },
  defaultVariants: { variant: 'outline', size: 'md' },
});
