import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { IconButton } from './button';
import { cn } from './class-names';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /** Names the close button, which shows only an icon. */
  closeLabel: string;
};

/** The portal, the dimmed overlay, the surface and its close button; `className` places it. */
export function ModalContent({ closeLabel, className, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="tw:fixed tw:inset-0 tw:z-overlay tw:bg-overlay tw:data-[state=open]:animate-fade-in tw:data-[state=closed]:animate-fade-out tw:motion-reduce:animate-none"
      />
      <DialogPrimitive.Content
        className={cn(
          'tw:fixed tw:z-modal tw:border-border tw:bg-popover tw:p-6 tw:font-sans tw:text-fg tw:shadow-lg tw:outline-none tw:motion-reduce:animate-none',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <IconButton size="sm" aria-label={closeLabel} className="tw:absolute tw:top-3 tw:right-3">
            <X aria-hidden="true" />
          </IconButton>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Radix warns in development when a dialog has no `DialogTitle`: every dialog needs one. */
export function DialogContent({ className, ...props }: DialogContentProps) {
  return (
    <ModalContent
      data-slot="dialog-content"
      className={cn(
        'tw:inset-x-4 tw:top-1/2 tw:mx-auto tw:grid tw:max-h-(--vp-modal-max-height) tw:max-w-lg tw:-translate-y-1/2 tw:gap-4 tw:overflow-y-auto tw:rounded-xl tw:border tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out',
        className
      )}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:pr-8', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'tw:flex tw:flex-col-reverse tw:gap-2 tw:sm:flex-row tw:sm:justify-end',
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('tw:m-0 tw:text-lg tw:font-medium', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('tw:m-0 tw:text-sm tw:text-fg-muted', className)}
      {...props}
    />
  );
}
