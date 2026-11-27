import { tv } from '../../lib/class-names';
import { inputStyles } from '../input/input.variants';

export const selectStyles = tv({
  extend: inputStyles,
  slots: {
    root: 'group cursor-pointer justify-between text-start data-placeholder:text-fg-subtle',
    chevron:
      'text-fg-muted transition-transform duration-fast group-data-[state=open]:rotate-180 motion-reduce:transition-none',
    indicator: 'absolute end-2 inline-flex items-center text-accent-ink',
  },
});
