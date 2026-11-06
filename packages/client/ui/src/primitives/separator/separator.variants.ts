import { tv } from '../../lib/class-names';
import type { SeparatorOrientation, SeparatorTone } from './types';

export const separatorStyles = tv({
  base: 'shrink-0',
  variants: {
    orientation: {
      horizontal: 'h-(--border-divider) w-full',
      vertical: 'w-(--border-divider) self-stretch',
    } satisfies Record<SeparatorOrientation, string>,
    tone: {
      subtle: 'bg-border',
      strong: 'bg-border-strong',
    } satisfies Record<SeparatorTone, string>,
  },
  defaultVariants: { orientation: 'horizontal', tone: 'subtle' },
});
