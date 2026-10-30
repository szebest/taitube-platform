import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, Fragment, type PointerEvent, useRef, useState } from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import { DrawerContext, useDrawer } from './drawer.context';
import { drawerStyles } from './drawer.variants';
import type { DrawerSize } from './types';

const DISMISS_FRACTION = 0.3;
const CLICK_SLOP_PX = 4;

export function DrawerRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = (next: boolean) => {
    setUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <DrawerContext value={{ open, setOpen }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </DrawerContext>
  );
}

export interface DrawerContentProps extends ComponentPropsWithRef<typeof DialogPrimitive.Content> {
  size?: DrawerSize;
  /** Render in place instead of in a portal, for the server render, where a portal has no container. */
  inline?: boolean;
}

export function DrawerContent({
  size = 'md',
  inline = false,
  className,
  ...props
}: DrawerContentProps) {
  const styles = drawerStyles({ size });
  const Layer = inline ? Fragment : DialogPrimitive.Portal;

  return (
    <Layer>
      <DialogPrimitive.Overlay data-slot="drawer-overlay" className={styles.overlay()} />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        className={styles.content({ className })}
        {...props}
      />
    </Layer>
  );
}

/** The grip: drag it down to dismiss, or press it. A button, so the keyboard reaches it. */
export function DrawerHandle({ className, onClick, ...props }: ComponentPropsWithRef<'button'>) {
  const { close } = useUiCopy();
  const { setOpen } = useDrawer('Handle');
  const drag = useRef<{ startY: number; surface: HTMLElement; offset: number } | undefined>(
    undefined
  );

  const start = (event: PointerEvent<HTMLButtonElement>) => {
    const surface = event.currentTarget.closest<HTMLElement>('[data-slot="drawer-content"]');
    if (!surface) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, surface, offset: 0 };
  };

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    drag.current.offset = Math.max(0, event.clientY - drag.current.startY);
    drag.current.surface.style.translate = `0 ${drag.current.offset}px`;
  };

  const release = () => {
    if (!drag.current) return;
    const { surface, offset } = drag.current;
    if (offset > surface.offsetHeight * DISMISS_FRACTION) setOpen(false);
    else surface.style.translate = '';
  };

  return (
    <button
      type="button"
      data-slot="drawer-handle"
      aria-label={close}
      className={drawerStyles().handle({ className })}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onClick={(event) => {
        onClick?.(event);
        const dragged = (drag.current?.offset ?? 0) > CLICK_SLOP_PX;
        drag.current = undefined;
        if (!dragged) setOpen(false);
      }}
      {...props}
    />
  );
}

export function DrawerTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={drawerStyles().title({ className })}
      {...props}
    />
  );
}

export function DrawerDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={drawerStyles().description({ className })}
      {...props}
    />
  );
}

export function DrawerBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div data-slot="drawer-body" className={drawerStyles().body({ className })} {...props} />;
}

export function DrawerFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div data-slot="drawer-footer" className={drawerStyles().footer({ className })} {...props} />
  );
}
