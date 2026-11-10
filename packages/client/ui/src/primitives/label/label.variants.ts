import { tv } from '../../lib/class-names';
import type { LabelSize } from './types';

export const labelStyles = tv({
  base: 'inline-flex items-baseline gap-inline font-sans text-fg peer-disabled:cursor-not-allowed peer-disabled:text-fg-subtle',
  variants: {
    size: {
      sm: 'text-body-sm font-(weight:--type-label-weight)',
      md: 'text-label',
    } satisfies Record<LabelSize, string>,
  },
  defaultVariants: { size: 'md' },
});
