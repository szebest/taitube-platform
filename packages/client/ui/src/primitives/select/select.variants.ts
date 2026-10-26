import { tv } from '../../lib/class-names';
import { inputStyles } from '../input/input.variants';

export const selectStyles = tv({
  extend: inputStyles,
  slots: {
    root: 'tw:group tw:cursor-pointer tw:justify-between tw:text-start tw:data-placeholder:text-fg-subtle',
    chevron:
      'tw:text-fg-muted tw:transition-transform tw:duration-fast tw:group-data-[state=open]:rotate-180 tw:motion-reduce:transition-none',
    indicator: 'tw:absolute tw:end-2 tw:inline-flex tw:items-center tw:text-accent-ink',
  },
});
