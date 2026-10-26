import { tv } from '../../lib/class-names';
import type { LabelSize } from './types';

export const labelStyles = tv({
  base: 'tw:inline-flex tw:items-baseline tw:gap-inline tw:font-sans tw:text-fg tw:select-none tw:peer-disabled:cursor-not-allowed tw:peer-disabled:text-fg-subtle',
  variants: {
    size: {
      sm: 'tw:text-body-sm tw:font-semibold',
      md: 'tw:text-label',
    } satisfies Record<LabelSize, string>,
  },
  defaultVariants: { size: 'md' },
});
