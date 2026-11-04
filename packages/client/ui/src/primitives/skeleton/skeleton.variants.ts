import type { RadiusOption } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';
import type { SkeletonShape } from './types';

export const skeletonStyles = tv({
  base: 'block bg-tint motion-safe:bg-linear-to-r motion-safe:from-tint motion-safe:via-tint-strong motion-safe:to-tint motion-safe:bg-size-[200%_100%] motion-safe:animate-shimmer',
  variants: {
    radius: {
      xs: 'rounded-xs',
      sm: 'rounded-sm',
      thumb: 'rounded-thumb',
      card: 'rounded-card',
      sheet: 'rounded-sheet',
      control: 'rounded-control',
      chip: 'rounded-chip',
    } satisfies Record<RadiusOption, string>,
    // After radius, so a circle and a text line keep their own corners over it.
    shape: {
      rect: '',
      circle: 'aspect-square rounded-full',
      text: 'h-lh rounded-xs',
    } satisfies Record<SkeletonShape, string>,
  },
  defaultVariants: { shape: 'rect', radius: 'thumb' },
});
