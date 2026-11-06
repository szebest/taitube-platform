import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/class-names';
import { usePhysicalSide } from '../../lib/physical-side';
import type { PortalContainer } from '../../portal-container';
import type { Align, Side } from '../../types';

const OPEN_DELAY_MS = 400;
const SKIP_DELAY_MS = 300;

/** Mounted once, at the root: tooltips share its delay, so moving between triggers is instant. */
export function TooltipProvider({
  delayDuration = OPEN_DELAY_MS,
  skipDelayDuration = SKIP_DELAY_MS,
  ...props
}: ComponentPropsWithRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

export interface TooltipContentProps
  extends Omit<ComponentPropsWithRef<typeof TooltipPrimitive.Content>, 'side' | 'align'>,
    PortalContainer {
  side?: Side;
  align?: Align;
}

export function TooltipContent({
  side = 'block-start',
  align,
  sideOffset = 6,
  collisionPadding = 8,
  container,
  className,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={usePhysicalSide(side)}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-tooltip flex max-w-[min(20rem,var(--radix-tooltip-content-available-width))] origin-(--radix-tooltip-content-transform-origin) items-center gap-inline rounded-sm bg-fg px-2 py-1 font-sans text-caption font-(weight:--type-label-weight) text-balance wrap-break-word text-bg shadow-2 select-none motion-enter [&_[data-slot=kbd]]:border-bg/40 [&_[data-slot=kbd]]:bg-transparent [&_[data-slot=kbd]]:text-bg',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow width={10} height={5} className="fill-fg" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
