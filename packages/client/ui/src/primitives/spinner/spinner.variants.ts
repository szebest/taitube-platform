import type { IconSize } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';
import type { SpinnerTone } from './types';

export const spinnerStyles = tv({
  base: 'tw:inline-flex tw:shrink-0',
  variants: {
    size: {
      sm: 'tw:size-icon-sm',
      md: 'tw:size-icon-md',
      lg: 'tw:size-icon-lg',
    } satisfies Record<IconSize, string>,
    tone: {
      neutral: 'tw:text-fg-muted',
      accent: 'tw:text-accent-ink',
    } satisfies Record<SpinnerTone, string>,
  },
  defaultVariants: { size: 'md', tone: 'neutral' },
});
