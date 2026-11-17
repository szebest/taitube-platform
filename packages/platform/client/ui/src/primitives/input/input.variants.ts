import { tv } from '../../lib/class-names';
import type { InputFill, InputShape, InputSize } from './types';

export const CONTROL_FILLS = {
  outline: 'border-border-strong bg-surface hover:bg-tint',
  soft: 'border-transparent bg-tint',
} satisfies Record<InputFill, string>;

const CONTROL_SHAPES = {
  text: 'rounded-control',
  pill: 'rounded-full',
} satisfies Record<InputShape, string>;

export const inputStyles = tv({
  slots: {
    root: 'flex w-full min-w-0 items-center gap-inline border-control px-inset-control font-sans text-fg transition-colors duration-fast placeholder:text-fg-subtle focus-ring focus-visible:ring-4 focus-visible:ring-accent-soft has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid has-[input:focus-visible]:outline-focus-ring has-[input:focus-visible]:outline-offset-focus has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-accent-soft read-only:focus-visible:ring-0 aria-invalid:border-danger-ink has-[[aria-invalid=true]]:border-danger-ink disabled:cursor-not-allowed disabled:bg-tint disabled:text-fg-subtle motion-reduce:transition-none',
    input:
      'min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-[length:inherit] text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:text-fg-subtle',
    adornment: 'inline-flex shrink-0 items-center gap-inline text-fg-muted',
  },
  variants: {
    variant: {
      outline: { root: CONTROL_FILLS.outline },
      soft: { root: CONTROL_FILLS.soft },
    } satisfies Record<InputFill, object>,
    size: {
      sm: { root: 'h-control-sm text-body-sm' },
      md: { root: 'h-control-md text-body' },
      lg: { root: 'h-control-lg text-body' },
    } satisfies Record<InputSize, object>,
    shape: {
      text: { root: CONTROL_SHAPES.text },
      pill: { root: CONTROL_SHAPES.pill },
    } satisfies Record<InputShape, object>,
  },
  defaultVariants: { variant: 'outline', size: 'md', shape: 'text' },
});
