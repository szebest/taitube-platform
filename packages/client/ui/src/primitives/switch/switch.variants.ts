import { tv } from '../../lib/class-names';
import type { SwitchSize } from './types';

export const switchStyles = tv({
  slots: {
    root: 'peer relative inline-flex shrink-0 cursor-pointer items-center rounded-control border-0 bg-tint-strong p-0.5 transition-colors duration-fast touch-target focus-ring hover:bg-border disabled:cursor-not-allowed disabled:bg-tint data-[state=checked]:bg-accent data-[state=checked]:hover:bg-accent-hover data-[state=checked]:disabled:bg-tint motion-reduce:transition-none',
    thumb:
      'pointer-events-none block aspect-square h-full rounded-[inherit] bg-fg shadow-1 transition-transform duration-fast ease-settle data-[state=checked]:bg-on-accent data-[state=checked]:translate-x-full rtl:data-[state=checked]:-translate-x-full disabled:bg-fg-subtle motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { root: 'h-icon-md w-9' },
      md: { root: 'h-icon-lg w-12' },
    } satisfies Record<SwitchSize, object>,
  },
  defaultVariants: { size: 'md' },
});
