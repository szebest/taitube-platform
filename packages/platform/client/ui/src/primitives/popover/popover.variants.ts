import { tv } from '../../lib/class-names';
import type { PopoverSize } from './types';

export const popoverStyles = tv({
  base: 'z-popover max-h-(--radix-popover-content-available-height) max-w-(--radix-popover-content-available-width) overflow-y-auto origin-(--radix-popover-content-transform-origin) rounded-card border-divider border-border bg-raised p-inset-control font-sans text-body-sm text-fg shadow-2 outline-none motion-enter',
  variants: {
    size: {
      sm: 'w-60',
      md: 'w-80',
      lg: 'w-100',
    } satisfies Record<PopoverSize, string>,
  },
  defaultVariants: { size: 'md' },
});
