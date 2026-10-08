import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { type VariantProps, cn, tv } from 'tailwind-variants';

import { IconButton } from './button';

export const sheetVariants = tv({
  base: 'tw:fixed tw:z-modal tw:flex tw:flex-col tw:gap-4 tw:overflow-y-auto tw:border-border tw:bg-surface-elevated tw:p-6 tw:font-sans tw:text-fg tw:shadow-lg tw:outline-none tw:motion-reduce:animate-none',
  variants: {
    side: {
      left: 'tw:inset-y-0 tw:left-0 tw:w-3/4 tw:max-w-sm tw:border-r tw:data-[state=open]:animate-slide-in-from-left tw:data-[state=closed]:animate-slide-out-to-left',
      right:
        'tw:inset-y-0 tw:right-0 tw:w-3/4 tw:max-w-sm tw:border-l tw:data-[state=open]:animate-slide-in-from-right tw:data-[state=closed]:animate-slide-out-to-right',
      top: 'tw:inset-x-0 tw:top-0 tw:border-b tw:data-[state=open]:animate-slide-in-from-top tw:data-[state=closed]:animate-slide-out-to-top',
      bottom:
        'tw:inset-x-0 tw:bottom-0 tw:max-h-(--vp-modal-max-height) tw:rounded-t-xl tw:border-t tw:data-[state=open]:animate-slide-in-from-bottom tw:data-[state=closed]:animate-slide-out-to-bottom',
    },
  },
  defaultVariants: { side: 'left' },
});

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export type SheetContentProps = ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & {
    /** Names the close button, which shows only an icon. */
    closeLabel: string;
  };

/** A dialog that slides in from an edge, the mobile navigation drawer for one. */
export function SheetContent({
  side,
  closeLabel,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="tw:fixed tw:inset-0 tw:z-overlay tw:bg-overlay tw:data-[state=open]:animate-fade-in tw:data-[state=closed]:animate-fade-out tw:motion-reduce:animate-none"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={sheetVariants({ side, className })}
        {...props}
      >
        {children}
        <SheetPrimitive.Close asChild>
          <IconButton size="sm" aria-label={closeLabel} className="tw:absolute tw:top-3 tw:right-3">
            <X aria-hidden="true" />
          </IconButton>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:pr-8', className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('tw:mt-auto tw:flex tw:flex-col tw:gap-2', className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('tw:m-0 tw:text-lg tw:font-medium', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('tw:m-0 tw:text-sm tw:text-fg-muted', className)}
      {...props}
    />
  );
}
