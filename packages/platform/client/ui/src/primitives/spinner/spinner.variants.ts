import type { IconSize } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';
import type { SpinnerTone } from './types';

export const spinnerStyles = tv({
  base: 'inline-flex shrink-0',
  variants: {
    size: {
      sm: 'size-icon-sm',
      md: 'size-icon-md',
      lg: 'size-icon-lg',
    } satisfies Record<IconSize, string>,
    tone: {
      neutral: 'text-fg-muted',
      accent: 'text-accent-ink',
    } satisfies Record<SpinnerTone, string>,
  },
  defaultVariants: { size: 'md', tone: 'neutral' },
});
