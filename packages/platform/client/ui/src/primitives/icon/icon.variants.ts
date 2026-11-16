import type { IconSize } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';
import type { IconTone } from './types';

export const iconStyles = tv({
  base: 'shrink-0',
  variants: {
    size: {
      sm: 'size-icon-sm',
      md: 'size-icon-md',
      lg: 'size-icon-lg',
    } satisfies Record<IconSize, string>,
    tone: {
      inherit: '',
      neutral: 'text-fg-muted',
      accent: 'text-accent-ink',
      danger: 'text-danger-ink',
    } satisfies Record<IconTone, string>,
    mirrored: { true: 'rtl:-scale-x-100' },
  },
  defaultVariants: { size: 'md', tone: 'inherit' },
});
