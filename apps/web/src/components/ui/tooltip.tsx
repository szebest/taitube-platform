import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { cn } from 'tailwind-variants';

const OPEN_DELAY_MS = 400;

/** Mounted once, at the root: tooltips share its delay, so moving between triggers is instant. */
export function TooltipProvider({
  delayDuration = OPEN_DELAY_MS,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'tw:z-tooltip tw:max-w-xs tw:origin-(--radix-tooltip-content-transform-origin) tw:rounded-md tw:bg-fg tw:px-2 tw:py-1 tw:font-sans tw:text-xs tw:text-surface tw:data-[state=closed]:animate-pop-out tw:data-[state=delayed-open]:animate-pop-in tw:data-[state=instant-open]:animate-fade-in tw:motion-reduce:animate-none',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export type TooltipProps = {
  content: ReactNode;
  /** The one focusable element the tooltip describes. */
  children: ReactElement;
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side'];
};

/** A trigger and its tooltip in one, for the common case. */
export function Tooltip({ content, children, side }: TooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  );
}
