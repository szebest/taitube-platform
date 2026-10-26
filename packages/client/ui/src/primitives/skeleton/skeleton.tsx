import type { RadiusOption } from '@vp/design-tokens';
import type { ComponentPropsWithRef } from 'react';
import { skeletonStyles } from './skeleton.variants';
import type { SkeletonShape } from './types';

export interface SkeletonProps extends ComponentPropsWithRef<'div'> {
  shape?: SkeletonShape;
  radius?: RadiusOption;
}

/** A placeholder sized by `className` to the content it stands in for; the loading region says it is busy. */
export function Skeleton({ shape, radius, className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={skeletonStyles({ shape, radius, className })}
      {...props}
    />
  );
}
