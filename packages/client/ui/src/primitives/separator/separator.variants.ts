import { tv } from '../../lib/class-names';
import type { SeparatorOrientation, SeparatorTone } from './types';

export const separatorStyles = tv({
  base: 'tw:shrink-0',
  variants: {
    orientation: {
      horizontal: 'tw:h-(--border-divider) tw:w-full',
      vertical: 'tw:w-(--border-divider) tw:self-stretch',
    } satisfies Record<SeparatorOrientation, string>,
    tone: {
      subtle: 'tw:bg-border',
      strong: 'tw:bg-border-strong',
    } satisfies Record<SeparatorTone, string>,
  },
  defaultVariants: { orientation: 'horizontal', tone: 'subtle' },
});
