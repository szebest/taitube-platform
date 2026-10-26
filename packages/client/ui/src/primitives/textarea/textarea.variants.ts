import { tv } from '../../lib/class-names';
import { CONTROL_FILLS } from '../input/input.variants';
import type { TextareaFill, TextareaSize } from './types';

export const textareaStyles = tv({
  base: 'tw:block tw:w-full tw:min-w-0 tw:rounded-sm tw:border-control tw:px-inset-control tw:py-2 tw:font-sans tw:text-fg tw:transition-colors tw:duration-fast tw:placeholder:text-fg-subtle tw:focus-ring tw:focus-visible:ring-4 tw:focus-visible:ring-accent-soft tw:read-only:focus-visible:ring-0 tw:aria-invalid:border-danger-ink tw:disabled:cursor-not-allowed tw:disabled:resize-none tw:disabled:bg-tint tw:disabled:text-fg-subtle tw:motion-reduce:transition-none',
  variants: {
    variant: CONTROL_FILLS satisfies Record<TextareaFill, string>,
    size: {
      sm: 'tw:text-body-sm',
      md: 'tw:text-body',
      lg: 'tw:text-body',
    } satisfies Record<TextareaSize, string>,
    autoGrow: {
      true: 'tw:max-h-64 tw:resize-none tw:field-sizing-content',
      false: 'tw:resize-y',
    },
  },
  defaultVariants: { variant: 'outline', size: 'md', autoGrow: false },
});
