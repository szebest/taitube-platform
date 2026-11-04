import { tv } from '../../lib/class-names';
import type { ToastTone } from './types';

export const toastStyles = tv({
  slots: {
    root: 'relative grid grid-cols-[auto_1fr_auto] items-center gap-x-inline rounded-card border-divider border-s-4 border-border bg-raised p-inset-control pe-control-md font-sans text-fg shadow-3 motion-enter motion-enter-toast data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 ltr:data-[swipe=end]:data-[state=closed]:animate-slide-out-to-right rtl:data-[swipe=end]:data-[state=closed]:animate-slide-out-to-left',
    icon: 'col-start-1 row-span-2 size-icon-md',
    title: 'col-start-2 m-0 text-label',
    description: 'col-start-2 m-0 text-body-sm text-fg-muted',
    action: 'col-start-3 row-span-2 row-start-1',
    close: 'absolute end-1 top-1',
    viewport:
      'fixed end-0 bottom-0 z-toast m-0 flex max-h-dvh w-full list-none flex-col gap-inline p-gutter-compact outline-none medium:max-w-[24rem]',
  },
  variants: {
    tone: {
      neutral: { root: 'border-s-border-strong', icon: 'text-fg-muted' },
      success: { root: 'border-s-success-ink', icon: 'text-success-ink' },
      warning: { root: 'border-s-warning-ink', icon: 'text-warning-ink' },
      danger: { root: 'border-s-danger-ink', icon: 'text-danger-ink' },
      info: { root: 'border-s-info-ink', icon: 'text-info-ink' },
    } satisfies Record<ToastTone, object>,
  },
  defaultVariants: { tone: 'neutral' },
});
