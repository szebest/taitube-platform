import type { IconSize } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';
import type { IconTone } from './types';

export const iconStyles = tv({
  base: 'tw:shrink-0',
  variants: {
    size: {
      sm: 'tw:size-icon-sm',
      md: 'tw:size-icon-md',
      lg: 'tw:size-icon-lg',
    } satisfies Record<IconSize, string>,
    tone: {
      inherit: '',
      neutral: 'tw:text-fg-muted',
      accent: 'tw:text-accent-ink',
      danger: 'tw:text-danger-ink',
    } satisfies Record<IconTone, string>,
    mirrored: { true: 'tw:rtl:-scale-x-100' },
  },
  defaultVariants: { size: 'md', tone: 'inherit' },
});
