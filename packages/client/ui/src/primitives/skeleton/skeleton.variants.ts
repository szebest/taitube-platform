import type { RadiusOption } from '@vp/design-tokens';
import { tv } from '../../lib/class-names';
import type { SkeletonShape } from './types';

export const skeletonStyles = tv({
  base: 'tw:block tw:bg-tint tw:motion-safe:bg-linear-to-r tw:motion-safe:from-tint tw:motion-safe:via-tint-strong tw:motion-safe:to-tint tw:motion-safe:bg-size-[200%_100%] tw:motion-safe:animate-shimmer',
  variants: {
    radius: {
      xs: 'tw:rounded-xs',
      sm: 'tw:rounded-sm',
      thumb: 'tw:rounded-thumb',
      card: 'tw:rounded-card',
      sheet: 'tw:rounded-sheet',
      control: 'tw:rounded-control',
      chip: 'tw:rounded-chip',
    } satisfies Record<RadiusOption, string>,
    // After radius, so a circle and a text line keep their own corners over it.
    shape: {
      rect: '',
      circle: 'tw:aspect-square tw:rounded-full',
      text: 'tw:h-lh tw:rounded-xs',
    } satisfies Record<SkeletonShape, string>,
  },
  defaultVariants: { shape: 'rect', radius: 'thumb' },
});
