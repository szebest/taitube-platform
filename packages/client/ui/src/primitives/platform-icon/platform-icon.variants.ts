import type { IconSize } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';

export const platformIconStyles = tv({
  base: 'shrink-0 fill-current',
  variants: {
    size: {
      sm: 'size-icon-sm',
      md: 'size-icon-md',
      lg: 'size-icon-lg',
    } satisfies Record<IconSize, string>,
  },
  defaultVariants: { size: 'md' },
});
