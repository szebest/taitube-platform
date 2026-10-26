import { tv } from '../../lib/class-names';
import type { InputFill, InputShape, InputSize } from './types';

export const CONTROL_FILLS = {
  outline: 'tw:border-border-strong tw:bg-surface tw:hover:bg-tint',
  soft: 'tw:border-transparent tw:bg-tint',
} satisfies Record<InputFill, string>;

const CONTROL_SHAPES = {
  text: 'tw:rounded-control',
  pill: 'tw:rounded-full',
} satisfies Record<InputShape, string>;

export const inputStyles = tv({
  slots: {
    root: 'tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-inline tw:border-control tw:px-inset-control tw:font-sans tw:text-fg tw:transition-colors tw:duration-fast tw:placeholder:text-fg-subtle tw:focus-ring tw:focus-visible:ring-4 tw:focus-visible:ring-accent-soft tw:has-[input:focus-visible]:outline-focus tw:has-[input:focus-visible]:outline-solid tw:has-[input:focus-visible]:outline-focus-ring tw:has-[input:focus-visible]:outline-offset-focus tw:has-[input:focus-visible]:ring-4 tw:has-[input:focus-visible]:ring-accent-soft tw:read-only:focus-visible:ring-0 tw:aria-invalid:border-danger-ink tw:has-[[aria-invalid=true]]:border-danger-ink tw:disabled:cursor-not-allowed tw:disabled:bg-tint tw:disabled:text-fg-subtle tw:motion-reduce:transition-none',
    input:
      'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:font-sans tw:text-[length:inherit] tw:text-fg tw:outline-none tw:placeholder:text-fg-subtle tw:disabled:cursor-not-allowed tw:disabled:text-fg-subtle',
    adornment: 'tw:inline-flex tw:shrink-0 tw:items-center tw:gap-inline tw:text-fg-muted',
  },
  variants: {
    variant: {
      outline: { root: CONTROL_FILLS.outline },
      soft: { root: CONTROL_FILLS.soft },
    } satisfies Record<InputFill, object>,
    size: {
      sm: { root: 'tw:h-control-sm tw:text-body-sm' },
      md: { root: 'tw:h-control-md tw:text-body' },
      lg: { root: 'tw:h-control-lg tw:text-body' },
    } satisfies Record<InputSize, object>,
    shape: {
      text: { root: CONTROL_SHAPES.text },
      pill: { root: CONTROL_SHAPES.pill },
    } satisfies Record<InputShape, object>,
  },
  defaultVariants: { variant: 'outline', size: 'md', shape: 'text' },
});
