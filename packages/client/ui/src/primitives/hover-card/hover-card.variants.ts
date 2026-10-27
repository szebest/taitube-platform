import { tv } from '../../lib/class-names';
import type { HoverCardSize } from './types';

export const hoverCardStyles = tv({
  base: 'tw:z-popover tw:max-w-(--radix-hover-card-content-available-width) tw:origin-(--radix-hover-card-content-transform-origin) tw:rounded-card tw:border-divider tw:border-border tw:bg-raised tw:p-inset-card tw:font-sans tw:text-body-sm tw:text-fg tw:shadow-2 tw:outline-none tw:motion-enter',
  variants: {
    size: {
      sm: 'tw:w-70',
      md: 'tw:w-90',
    } satisfies Record<HoverCardSize, string>,
  },
  defaultVariants: { size: 'md' },
});
