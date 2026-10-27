import { tv } from '../../lib/class-names';
import type { PopoverSize } from './types';

export const popoverStyles = tv({
  base: 'tw:z-popover tw:max-w-(--radix-popover-content-available-width) tw:origin-(--radix-popover-content-transform-origin) tw:rounded-card tw:border-divider tw:border-border tw:bg-raised tw:p-inset-control tw:font-sans tw:text-body-sm tw:text-fg tw:shadow-2 tw:outline-none tw:motion-enter',
  variants: {
    size: {
      sm: 'tw:w-60',
      md: 'tw:w-80',
      lg: 'tw:w-100',
    } satisfies Record<PopoverSize, string>,
  },
  defaultVariants: { size: 'md' },
});
