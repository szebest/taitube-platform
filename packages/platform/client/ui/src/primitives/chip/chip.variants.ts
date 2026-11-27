import { tv } from '../../lib/class-names';
import { slidingIndicatorBase } from '../../lib/sliding-indicator';
import type { ChipFill, ChipSize } from './types';

export const chipStyles = tv({
  base: 'inline-flex shrink-0 cursor-pointer items-center justify-center gap-inline rounded-chip px-inset-control font-sans text-label whitespace-nowrap no-underline transition-colors duration-fast ease-standard touch-target focus-ring active:scale-97 disabled:cursor-not-allowed disabled:bg-tint disabled:text-fg-subtle disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-icon-sm',
  variants: {
    variant: {
      soft: 'border-0 bg-tint text-fg hover:bg-tint-strong aria-pressed:bg-fg aria-pressed:text-bg aria-[current=true]:bg-fg aria-[current=true]:text-bg not-in-data-[indicator=shown]:data-[state=on]:bg-fg in-data-[indicator=shown]:data-[state=on]:bg-transparent data-[state=on]:text-bg',
      outline:
        'border-control border-border-strong bg-transparent text-fg hover:bg-tint aria-pressed:bg-accent-soft aria-pressed:text-accent-ink aria-[current=true]:bg-accent-soft aria-[current=true]:text-accent-ink data-[state=on]:bg-accent-soft data-[state=on]:text-accent-ink',
    } satisfies Record<ChipFill, string>,
    size: {
      sm: 'h-control-sm',
      md: 'h-control-md',
    } satisfies Record<ChipSize, string>,
  },
  defaultVariants: { variant: 'soft', size: 'sm' },
});

export const chipGroupStyles = tv({
  base: 'relative flex gap-inline overflow-x-auto scroll-fade',
});

export const chipIndicatorStyles = `${slidingIndicatorBase} h-(--indicator-height) w-(--indicator-width) translate-x-(--indicator-x) translate-y-(--indicator-y) rounded-chip bg-fg`;
