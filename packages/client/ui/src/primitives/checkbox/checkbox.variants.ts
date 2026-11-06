import { tv } from '../../lib/class-names';
import type { CheckboxSize } from './types';

export const checkboxStyles = tv({
  slots: {
    root: 'peer relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xs border-control border-border-strong bg-surface p-0 text-on-accent transition-colors duration-fast touch-target focus-ring hover:bg-tint active:bg-tint-strong disabled:cursor-not-allowed disabled:bg-tint disabled:text-fg-subtle aria-invalid:border-danger-ink data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent motion-reduce:transition-none',
    indicator:
      'group flex items-center justify-center data-[state=checked]:animate-pop-in data-[state=indeterminate]:animate-pop-in',
    check: 'group-data-[state=indeterminate]:hidden',
    dash: 'hidden group-data-[state=indeterminate]:block h-0.5 w-2/3 rounded-full bg-current',
  },
  variants: {
    size: {
      sm: { root: 'size-icon-sm', indicator: 'size-full' },
      md: { root: 'size-icon-md', indicator: 'size-full' },
    } satisfies Record<CheckboxSize, object>,
  },
  defaultVariants: { size: 'md' },
});
