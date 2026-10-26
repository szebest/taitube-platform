import { Label as LabelPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { labelStyles } from './label.variants';
import type { LabelSize } from './types';

export interface LabelProps extends ComponentPropsWithRef<typeof LabelPrimitive.Root> {
  size?: LabelSize;
}

export function Label({ size, className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={labelStyles({ size, className })}
      {...props}
    />
  );
}
