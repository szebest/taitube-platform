import { tv } from '../../lib/class-names';
import type { ChipFill, ChipSize } from './types';

export const chipStyles = tv({
  base: 'tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-inline tw:rounded-chip tw:px-inset-control tw:font-sans tw:text-label tw:whitespace-nowrap tw:no-underline tw:transition-colors tw:duration-fast tw:touch-target tw:focus-ring tw:active:scale-97 tw:disabled:cursor-not-allowed tw:disabled:bg-tint tw:disabled:text-fg-subtle tw:disabled:active:scale-100 tw:motion-reduce:transition-none tw:motion-reduce:active:scale-100 tw:[&_svg]:size-icon-sm',
  variants: {
    variant: {
      soft: 'tw:border-0 tw:bg-tint tw:text-fg tw:hover:bg-tint-strong tw:aria-pressed:bg-fg tw:aria-pressed:text-bg tw:aria-[current=true]:bg-fg tw:aria-[current=true]:text-bg tw:data-[state=on]:bg-fg tw:data-[state=on]:text-bg',
      outline:
        'tw:border-control tw:border-border-strong tw:bg-transparent tw:text-fg tw:hover:bg-tint tw:aria-pressed:bg-accent-soft tw:aria-pressed:text-accent-ink tw:aria-[current=true]:bg-accent-soft tw:aria-[current=true]:text-accent-ink tw:data-[state=on]:bg-accent-soft tw:data-[state=on]:text-accent-ink',
    } satisfies Record<ChipFill, string>,
    size: {
      sm: 'tw:h-control-sm',
      md: 'tw:h-control-md',
    } satisfies Record<ChipSize, string>,
  },
  defaultVariants: { variant: 'soft', size: 'sm' },
});

export const chipGroupStyles = tv({
  base: 'tw:flex tw:gap-inline tw:overflow-x-auto tw:scroll-fade',
});
