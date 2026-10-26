import { Toast as ToastPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import type { IconId } from '../../icons/inventory';
import { TONE_ICONS } from '../../lib/tone-icons';
import { Icon, type IconProps } from '../icon';
import { IconButton } from '../icon-button';
import { ToastContext, useToastItem } from './toast.context';
import { toastStyles } from './toast.variants';
import type { ToastTone } from './types';

export interface ToastRootProps extends ComponentPropsWithRef<typeof ToastPrimitive.Root> {
  tone?: ToastTone;
}

/** A failure interrupts a screen reader; every other tone waits its turn. */
export function ToastRoot({ tone = 'neutral', className, ...props }: ToastRootProps) {
  const shared = useMemo(() => ({ tone }), [tone]);

  return (
    <ToastContext value={shared}>
      <ToastPrimitive.Root
        data-slot="toast"
        type={tone === 'danger' ? 'foreground' : 'background'}
        className={toastStyles(shared).root({ className })}
        {...props}
      />
    </ToastContext>
  );
}

export interface ToastIconProps extends Omit<IconProps, 'name'> {
  /** The tone's own glyph by default. */
  name?: IconId;
}

export function ToastIcon({ name, className, ...props }: ToastIconProps) {
  const shared = useToastItem('Icon');

  return (
    <Icon
      data-slot="toast-icon"
      name={name ?? TONE_ICONS[shared.tone]}
      className={toastStyles(shared).icon({ className })}
      {...props}
    />
  );
}

export function ToastTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof ToastPrimitive.Title>) {
  const shared = useToastItem('Title');

  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={toastStyles(shared).title({ className })}
      {...props}
    />
  );
}

export function ToastDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof ToastPrimitive.Description>) {
  const shared = useToastItem('Description');

  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={toastStyles(shared).description({ className })}
      {...props}
    />
  );
}

export function ToastAction({
  className,
  ...props
}: ComponentPropsWithRef<typeof ToastPrimitive.Action>) {
  const shared = useToastItem('Action');

  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={toastStyles(shared).action({ className })}
      {...props}
    />
  );
}

export function ToastClose({ className }: { className?: string }) {
  const { close } = useUiCopy();
  const shared = useToastItem('Close');

  return (
    <ToastPrimitive.Close asChild>
      <IconButton
        data-slot="toast-close"
        size="sm"
        aria-label={close}
        className={toastStyles(shared).close({ className })}
      >
        <Icon name="close" />
      </IconButton>
    </ToastPrimitive.Close>
  );
}
