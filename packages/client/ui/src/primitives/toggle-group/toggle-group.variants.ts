import { tv } from '../../lib/class-names';
import type { Orientation } from '../../types';
import type { ToggleFill, ToggleShape, ToggleSize } from './types';

export const toggleGroupStyles = tv({
  slots: {
    root: 'tw:inline-flex tw:gap-inline tw:font-sans',
    item: 'tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-inline tw:border-0 tw:px-inset-control tw:text-label tw:whitespace-nowrap tw:transition-colors tw:duration-fast tw:touch-target tw:focus-ring tw:hover:bg-tint tw:active:scale-97 tw:disabled:cursor-not-allowed tw:disabled:bg-transparent tw:disabled:text-fg-subtle tw:disabled:active:scale-100 tw:motion-reduce:transition-none tw:motion-reduce:active:scale-100',
  },
  variants: {
    variant: {
      ghost: { item: 'tw:bg-transparent tw:text-fg tw:data-[state=on]:bg-tint-strong' },
      outline: {
        item: 'tw:border-control tw:border-border-strong tw:bg-transparent tw:text-fg tw:data-[state=on]:bg-tint',
      },
      soft: {
        item: 'tw:bg-transparent tw:text-fg-muted tw:data-[state=on]:bg-accent-soft tw:data-[state=on]:text-accent-ink',
      },
    } satisfies Record<ToggleFill, object>,
    size: {
      sm: { item: 'tw:h-control-sm tw:[&_svg]:size-icon-sm' },
      md: { item: 'tw:h-control-md tw:[&_svg]:size-icon-md' },
      lg: { item: 'tw:h-control-lg tw:[&_svg]:size-icon-md' },
    } satisfies Record<ToggleSize, object>,
    shape: {
      text: { item: 'tw:rounded-control' },
      pill: { item: 'tw:rounded-full' },
    } satisfies Record<ToggleShape, object>,
    orientation: {
      horizontal: { root: 'tw:flex-row' },
      vertical: { root: 'tw:flex-col' },
    } satisfies Record<Orientation, object>,
  },
  defaultVariants: { variant: 'ghost', size: 'md', shape: 'text', orientation: 'horizontal' },
});
