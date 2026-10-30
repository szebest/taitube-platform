import { tv } from '../../lib/class-names';
import type { CheckboxSize } from './types';

export const checkboxStyles = tv({
  slots: {
    root: 'tw:peer tw:relative tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-xs tw:border-control tw:border-border-strong tw:bg-surface tw:p-0 tw:text-on-accent tw:transition-colors tw:duration-fast tw:touch-target tw:focus-ring tw:hover:bg-tint tw:active:bg-tint-strong tw:disabled:cursor-not-allowed tw:disabled:bg-tint tw:disabled:text-fg-subtle tw:aria-invalid:border-danger-ink tw:data-[state=checked]:border-accent tw:data-[state=checked]:bg-accent tw:data-[state=indeterminate]:border-accent tw:data-[state=indeterminate]:bg-accent tw:motion-reduce:transition-none',
    indicator:
      'tw:group tw:flex tw:items-center tw:justify-center tw:data-[state=checked]:animate-pop-in tw:data-[state=indeterminate]:animate-pop-in',
    check: 'tw:group-data-[state=indeterminate]:hidden',
    dash: 'tw:hidden tw:group-data-[state=indeterminate]:block tw:h-0.5 tw:w-2/3 tw:rounded-full tw:bg-current',
  },
  variants: {
    size: {
      sm: { root: 'tw:size-icon-sm', indicator: 'tw:size-full' },
      md: { root: 'tw:size-icon-md', indicator: 'tw:size-full' },
    } satisfies Record<CheckboxSize, object>,
  },
  defaultVariants: { size: 'md' },
});
