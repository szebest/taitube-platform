import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { cn } from 'tailwind-variants';

/** Mounted once, at the root: tooltips share its delay, so moving between triggers is instant. */
export function TooltipProvider({
  delayDuration = 400,
  skipDelayDuration = 300,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  sideOffset = 6,
  collisionPadding = 8,
  className,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'tw:z-tooltip tw:max-w-[min(20rem,var(--radix-tooltip-content-available-width))] tw:origin-(--radix-tooltip-content-transform-origin) tw:rounded-md tw:bg-fg tw:px-2.5 tw:py-1.5 tw:font-sans tw:text-xs tw:font-medium tw:text-balance tw:wrap-break-word tw:text-surface tw:shadow-md tw:select-none tw:data-[state=closed]:animate-pop-out tw:data-[state=delayed-open]:animate-pop-in tw:data-[state=instant-open]:animate-fade-in tw:motion-reduce:animate-none',
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

export type TooltipProps = Pick<
  ComponentProps<typeof TooltipPrimitive.Content>,
  'side' | 'align'
> & {
  content: ReactNode;
  /** The one focusable element the tooltip describes; a disabled button never fires its events. */
  children: ReactElement;
};

/** A trigger and its tooltip in one, for the common case; compose the parts for anything else. */
export function Tooltip({ content, children, side, align }: TooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}
