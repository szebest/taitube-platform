import { Separator as SeparatorPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { separatorStyles } from './separator.variants';
import type { SeparatorOrientation, SeparatorTone } from './types';

export interface SeparatorProps
  extends Omit<ComponentPropsWithRef<typeof SeparatorPrimitive.Root>, 'orientation'> {
  orientation?: SeparatorOrientation;
  tone?: SeparatorTone;
}

/** Decorative unless `decorative={false}`, which makes it a separator assistive technology reads. */
export function Separator({
  orientation = 'horizontal',
  decorative = true,
  tone,
  className,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      orientation={orientation}
      decorative={decorative}
      className={separatorStyles({ orientation, tone, className })}
      {...props}
    />
  );
}
