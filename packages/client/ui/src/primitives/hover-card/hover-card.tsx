import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/class-names';
import { usePhysicalSide } from '../../lib/physical-side';
import type { Align, Side } from '../../types';
import { hoverCardStyles } from './hover-card.variants';
import type { HoverCardSize } from './types';

const OPEN_DELAY_MS = 500;
const CLOSE_DELAY_MS = 150;

export function HoverCardRoot({
  openDelay = OPEN_DELAY_MS,
  closeDelay = CLOSE_DELAY_MS,
  ...props
}: ComponentPropsWithRef<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root openDelay={openDelay} closeDelay={closeDelay} {...props} />;
}

export interface HoverCardContentProps
  extends Omit<ComponentPropsWithRef<typeof HoverCardPrimitive.Content>, 'side' | 'align'> {
  size?: HoverCardSize;
  side?: Side;
  align?: Align;
}

export function HoverCardContent({
  size,
  side = 'block-end',
  align = 'center',
  sideOffset = 6,
  collisionPadding = 8,
  className,
  ...props
}: HoverCardContentProps) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        side={usePhysicalSide(side)}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={hoverCardStyles({ size, className })}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export function HoverCardArrow({
  className,
  ...props
}: ComponentPropsWithRef<typeof HoverCardPrimitive.Arrow>) {
  return (
    <HoverCardPrimitive.Arrow
      data-slot="hover-card-arrow"
      width={10}
      height={5}
      className={cn('tw:fill-raised', className)}
      {...props}
    />
  );
}
