import { AspectRatio as AspectRatioPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/class-names';
import type { MediaShape } from './types';

const RATIOS = {
  video: 16 / 9,
  poster: 9 / 16,
  square: 1,
  banner: 21 / 9,
} satisfies Record<MediaShape, number>;

export interface AspectRatioProps extends ComponentPropsWithRef<typeof AspectRatioPrimitive.Root> {
  shape?: MediaShape;
}

/** Reserves a media ratio before the media loads; a `ratio` number overrides the shape's. */
export function AspectRatio({ shape = 'video', ratio, className, ...props }: AspectRatioProps) {
  return (
    <AspectRatioPrimitive.Root
      data-slot="aspect-ratio"
      ratio={ratio ?? RATIOS[shape]}
      className={cn('tw:*:size-full tw:*:object-cover', className)}
      {...props}
    />
  );
}
