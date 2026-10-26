import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import { Icon } from '../icon';
import { IconButton } from '../icon-button';
import { DialogContext } from './dialog.context';
import { dialogStyles } from './dialog.variants';
import type { DialogSide, DialogSize } from './types';

export interface DialogContentProps extends ComponentPropsWithRef<typeof DialogPrimitive.Content> {
  side?: DialogSide;
  size?: DialogSize;
}

/** The portal, the overlay, the surface and its close button. Every dialog needs a `Dialog.Title`. */
export function DialogContent({
  side,
  size = 'md',
  className,
  children,
  ...props
}: DialogContentProps) {
  const { close } = useUiCopy();
  const shared = useMemo(() => ({ side, size }), [side, size]);
  const styles = dialogStyles({ side: side ?? 'centred', size });

  return (
    <DialogContext value={shared}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-slot="dialog-overlay" className={styles.overlay()} />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={styles.content({ className })}
          {...props}
        >
          {children}
          <DialogPrimitive.Close asChild>
            <IconButton size="sm" aria-label={close} className={styles.close()}>
              <Icon name="close" />
            </IconButton>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogContext>
  );
}

export function DialogHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div data-slot="dialog-header" className={dialogStyles().header({ className })} {...props} />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={dialogStyles().title({ className })}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={dialogStyles().description({ className })}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div data-slot="dialog-body" className={dialogStyles().body({ className })} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div data-slot="dialog-footer" className={dialogStyles().footer({ className })} {...props} />
  );
}
