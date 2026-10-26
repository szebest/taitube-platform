import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/class-names';
import { usePhysicalSide } from '../../lib/physical-side';
import type { Align, Side } from '../../types';
import { popoverStyles } from './popover.variants';
import type { PopoverSize } from './types';

export interface PopoverContentProps
  extends Omit<ComponentPropsWithRef<typeof PopoverPrimitive.Content>, 'side' | 'align'> {
  size?: PopoverSize;
  side?: Side;
  align?: Align;
}

export function PopoverContent({
  size,
  side = 'block-end',
  align = 'center',
  sideOffset = 6,
  collisionPadding = 8,
  className,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        side={usePhysicalSide(side)}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={popoverStyles({ size, className })}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export function PopoverArrow({
  className,
  ...props
}: ComponentPropsWithRef<typeof PopoverPrimitive.Arrow>) {
  return (
    <PopoverPrimitive.Arrow
      data-slot="popover-arrow"
      width={10}
      height={5}
      className={cn('tw:fill-raised', className)}
      {...props}
    />
  );
}
