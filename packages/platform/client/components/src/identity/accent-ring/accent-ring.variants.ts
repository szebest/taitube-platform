import { tv } from '@kit/ui';
import type { AccentRingAccent } from './types';

export const accentRingStyles = tv({
  base: 'inline-flex shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-bg transition-shadow duration-fast ease-standard motion-reduce:transition-none',
  variants: {
    accent: {
      1: 'ring-(color:--dataviz-categorical-1)',
      2: 'ring-(color:--dataviz-categorical-2)',
      3: 'ring-(color:--dataviz-categorical-3)',
      4: 'ring-(color:--dataviz-categorical-4)',
      5: 'ring-(color:--dataviz-categorical-5)',
      6: 'ring-(color:--dataviz-categorical-6)',
    } satisfies Record<AccentRingAccent, string>,
  },
});
