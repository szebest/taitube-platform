import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { dialogStyles } from '../dialog/dialog.variants';
import type { DialogSize } from '../dialog/types';

export interface AlertDialogContentProps
  extends ComponentPropsWithRef<typeof AlertDialogPrimitive.Content> {
  size?: DialogSize;
}

/** A decision the viewer must answer: an outside click never dismisses it. */
export function AlertDialogContent({ size = 'md', className, ...props }: AlertDialogContentProps) {
  const styles = dialogStyles({ side: 'centred', size });

  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay data-slot="alert-dialog-overlay" className={styles.overlay()} />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={styles.content({ className })}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={dialogStyles().title({ className })}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={dialogStyles().description({ className })}
      {...props}
    />
  );
}
