import { tv } from '../../lib/class-names';
import type { ProgressSize, ProgressTone } from './types';

export const progressStyles = tv({
  slots: {
    root: 'relative block w-full overflow-hidden rounded-chip bg-tint-strong data-[state=indeterminate]:motion-safe:animate-indeterminate data-[state=indeterminate]:bg-size-[50%_100%] data-[state=indeterminate]:bg-no-repeat',
    indicator:
      'block h-full w-full origin-left rounded-chip transition-transform duration-base ease-standard motion-reduce:transition-none rtl:origin-right data-[state=indeterminate]:hidden',
  },
  variants: {
    size: {
      sm: { root: 'h-1' },
      md: { root: 'h-1.5' },
      lg: { root: 'h-2' },
    } satisfies Record<ProgressSize, object>,
    tone: {
      accent: {
        root: 'data-[state=indeterminate]:bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]',
        indicator: 'bg-accent',
      },
      neutral: {
        root: 'data-[state=indeterminate]:bg-[linear-gradient(90deg,transparent,var(--fg),transparent)]',
        indicator: 'bg-fg',
      },
    } satisfies Record<ProgressTone, object>,
  },
  defaultVariants: { size: 'md', tone: 'accent' },
});
