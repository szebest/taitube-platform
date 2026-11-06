import { tv } from '../../lib/class-names';
import type { Orientation } from '../../types';
import type { ToggleFill, ToggleShape, ToggleSize } from './types';

export const toggleGroupStyles = tv({
  slots: {
    root: 'inline-flex gap-inline font-sans',
    item: 'inline-flex shrink-0 cursor-pointer items-center justify-center gap-inline border-0 px-inset-control text-label whitespace-nowrap transition-colors duration-fast touch-target focus-ring hover:bg-tint active:scale-97 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-fg-subtle disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100',
  },
  variants: {
    variant: {
      ghost: { item: 'bg-transparent text-fg data-[state=on]:bg-tint-strong' },
      outline: {
        item: 'border-control border-border-strong bg-transparent text-fg data-[state=on]:bg-tint',
      },
      soft: {
        item: 'bg-transparent text-fg-muted data-[state=on]:bg-accent-soft data-[state=on]:text-accent-ink',
      },
    } satisfies Record<ToggleFill, object>,
    size: {
      sm: { item: 'h-control-sm [&_svg]:size-icon-sm' },
      md: { item: 'h-control-md [&_svg]:size-icon-md' },
      lg: { item: 'h-control-lg [&_svg]:size-icon-md' },
    } satisfies Record<ToggleSize, object>,
    shape: {
      text: { item: 'rounded-control' },
      pill: { item: 'rounded-full' },
    } satisfies Record<ToggleShape, object>,
    orientation: {
      horizontal: { root: 'flex-row' },
      vertical: { root: 'flex-col' },
    } satisfies Record<Orientation, object>,
  },
  defaultVariants: { variant: 'ghost', size: 'md', shape: 'text', orientation: 'horizontal' },
});
