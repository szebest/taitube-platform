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
          'tw:z-tooltip tw:flex tw:max-w-[min(20rem,var(--radix-tooltip-content-available-width))] tw:origin-(--radix-tooltip-content-transform-origin) tw:items-center tw:gap-inline tw:rounded-sm tw:bg-fg tw:px-2 tw:py-1 tw:font-sans tw:text-caption tw:font-(weight:--type-label-weight) tw:text-balance tw:wrap-break-word tw:text-bg tw:shadow-2 tw:select-none tw:motion-enter tw:[&_[data-slot=kbd]]:border-bg/40 tw:[&_[data-slot=kbd]]:bg-transparent tw:[&_[data-slot=kbd]]:text-bg',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow width={10} height={5} className="tw:fill-fg" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
