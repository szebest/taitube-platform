import { tv } from '../../lib/class-names';
import type { HoverCardSize } from './types';

export const hoverCardStyles = tv({
  base: 'z-popover max-w-(--radix-hover-card-content-available-width) origin-(--radix-hover-card-content-transform-origin) rounded-card border-divider border-border bg-raised p-inset-card font-sans text-body-sm text-fg shadow-2 outline-none motion-enter',
  variants: {
    size: {
      sm: 'w-70',
      md: 'w-90',
    } satisfies Record<HoverCardSize, string>,
  },
  defaultVariants: { size: 'md' },
});
