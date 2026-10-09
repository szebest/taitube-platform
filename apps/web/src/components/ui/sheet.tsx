import type { ComponentProps } from 'react';
import { type VariantProps, cn, tv } from 'tailwind-variants';

import { type DialogContentProps, ModalContent } from './dialog';

export const sheetVariants = tv({
  base: 'tw:flex tw:flex-col tw:gap-4 tw:overflow-y-auto',
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

/**
 * A dialog that slides in from an edge, the mobile navigation drawer for one. It opens inside a
 * `Dialog` and takes its trigger, header, title, description and close parts.
 */
export function SheetContent({
  side,
  className,
  ...props
}: DialogContentProps & VariantProps<typeof sheetVariants>) {
  return (
    <ModalContent
      data-slot="sheet-content"
      className={sheetVariants({ side, className })}
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
