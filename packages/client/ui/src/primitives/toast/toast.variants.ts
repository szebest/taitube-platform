import { tv } from '../../lib/class-names';
import type { ToastTone } from './types';

export const toastStyles = tv({
  slots: {
    root: 'tw:relative tw:grid tw:grid-cols-[auto_1fr_auto] tw:items-center tw:gap-x-inline tw:rounded-card tw:border-divider tw:border-s-4 tw:border-border tw:bg-raised tw:p-inset-control tw:pe-control-md tw:font-sans tw:text-fg tw:shadow-3 tw:ltr:data-[state=open]:animate-slide-in-from-right tw:rtl:data-[state=open]:animate-slide-in-from-left tw:data-[state=closed]:animate-fade-out tw:data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) tw:data-[swipe=cancel]:translate-x-0 tw:ltr:data-[swipe=end]:animate-slide-out-to-right tw:rtl:data-[swipe=end]:animate-slide-out-to-left tw:motion-reduce:animate-none',
    icon: 'tw:col-start-1 tw:row-span-2 tw:size-icon-md',
    title: 'tw:col-start-2 tw:m-0 tw:text-label',
    description: 'tw:col-start-2 tw:m-0 tw:text-body-sm tw:text-fg-muted',
    action: 'tw:col-start-3 tw:row-span-2 tw:row-start-1',
    close: 'tw:absolute tw:end-1 tw:top-1',
    viewport:
      'tw:fixed tw:end-0 tw:bottom-0 tw:z-toast tw:m-0 tw:flex tw:max-h-dvh tw:w-full tw:list-none tw:flex-col tw:gap-inline tw:p-gutter-compact tw:outline-none tw:sm:max-w-sm',
  },
  variants: {
    tone: {
      neutral: { root: 'tw:border-s-border-strong', icon: 'tw:text-fg-muted' },
      success: { root: 'tw:border-s-success-ink', icon: 'tw:text-success-ink' },
      warning: { root: 'tw:border-s-warning-ink', icon: 'tw:text-warning-ink' },
      danger: { root: 'tw:border-s-danger-ink', icon: 'tw:text-danger-ink' },
      info: { root: 'tw:border-s-info-ink', icon: 'tw:text-info-ink' },
    } satisfies Record<ToastTone, object>,
  },
  defaultVariants: { tone: 'neutral' },
});
