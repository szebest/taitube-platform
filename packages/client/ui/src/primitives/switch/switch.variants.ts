import { tv } from '../../lib/class-names';
import type { SwitchSize } from './types';

export const switchStyles = tv({
  slots: {
    root: 'tw:peer tw:relative tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:rounded-control tw:border-0 tw:bg-tint-strong tw:p-0.5 tw:transition-colors tw:duration-fast tw:touch-target tw:focus-ring tw:hover:bg-border tw:disabled:cursor-not-allowed tw:disabled:bg-tint tw:data-[state=checked]:bg-accent tw:data-[state=checked]:hover:bg-accent-hover tw:data-[state=checked]:disabled:bg-tint tw:motion-reduce:transition-none',
    thumb:
      'tw:pointer-events-none tw:block tw:aspect-square tw:h-full tw:rounded-[inherit] tw:bg-fg tw:shadow-1 tw:transition-transform tw:duration-fast tw:ease-settle tw:data-[state=checked]:bg-on-accent tw:data-[state=checked]:translate-x-full tw:rtl:data-[state=checked]:-translate-x-full tw:disabled:bg-fg-subtle tw:motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { root: 'tw:h-icon-md tw:w-9' },
      md: { root: 'tw:h-icon-lg tw:w-12' },
    } satisfies Record<SwitchSize, object>,
  },
  defaultVariants: { size: 'md' },
});
