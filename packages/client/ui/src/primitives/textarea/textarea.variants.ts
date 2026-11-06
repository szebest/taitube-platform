import { tv } from '../../lib/class-names';
import { CONTROL_FILLS } from '../input/input.variants';
import type { TextareaFill, TextareaSize } from './types';

export const textareaStyles = tv({
  base: 'block w-full min-w-0 rounded-sm border-control px-inset-control py-2 font-sans text-fg transition-colors duration-fast placeholder:text-fg-subtle focus-ring focus-visible:ring-4 focus-visible:ring-accent-soft read-only:focus-visible:ring-0 aria-invalid:border-danger-ink disabled:cursor-not-allowed disabled:resize-none disabled:bg-tint disabled:text-fg-subtle motion-reduce:transition-none',
  variants: {
    variant: CONTROL_FILLS satisfies Record<TextareaFill, string>,
    size: {
      sm: 'text-body-sm',
      md: 'text-body',
      lg: 'text-body',
    } satisfies Record<TextareaSize, string>,
    autoGrow: {
      true: 'max-h-64 resize-none field-sizing-content',
      false: 'resize-y',
    },
  },
  defaultVariants: { variant: 'outline', size: 'md', autoGrow: false },
});
