import { tv } from '../../lib/class-names';
import type { ProgressSize, ProgressTone } from './types';

export const progressStyles = tv({
  slots: {
    root: 'tw:relative tw:block tw:w-full tw:overflow-hidden tw:rounded-chip tw:bg-tint-strong tw:data-[state=indeterminate]:motion-safe:animate-indeterminate tw:data-[state=indeterminate]:bg-size-[50%_100%] tw:data-[state=indeterminate]:bg-no-repeat',
    indicator:
      'tw:block tw:h-full tw:rounded-chip tw:transition-[inline-size] tw:duration-base tw:ease-standard tw:motion-reduce:transition-none tw:data-[state=indeterminate]:hidden',
  },
  variants: {
    size: {
      sm: { root: 'tw:h-1' },
      md: { root: 'tw:h-1.5' },
      lg: { root: 'tw:h-2' },
    } satisfies Record<ProgressSize, object>,
    tone: {
      accent: {
        root: 'tw:data-[state=indeterminate]:bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]',
        indicator: 'tw:bg-accent',
      },
      neutral: {
        root: 'tw:data-[state=indeterminate]:bg-[linear-gradient(90deg,transparent,var(--fg),transparent)]',
        indicator: 'tw:bg-fg',
      },
    } satisfies Record<ProgressTone, object>,
  },
  defaultVariants: { size: 'md', tone: 'accent' },
});
