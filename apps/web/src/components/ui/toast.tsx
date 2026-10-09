import { X } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { VariantProps } from 'tailwind-variants';
import { Button, IconButton } from './button';
import { tv } from './class-names';

export const toastVariants = tv({
  base: 'tw:relative tw:grid tw:grid-cols-[1fr_auto] tw:items-center tw:gap-x-3 tw:gap-y-1 tw:rounded-lg tw:border tw:border-l-4 tw:border-border tw:bg-popover tw:py-3 tw:pr-10 tw:pl-4 tw:font-sans tw:text-fg tw:shadow-lg tw:data-[state=open]:animate-slide-in-from-right tw:data-[state=closed]:animate-fade-out tw:data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) tw:data-[swipe=cancel]:translate-x-0 tw:data-[swipe=end]:animate-slide-out-to-right tw:motion-reduce:animate-none',
  variants: {
    variant: {
      neutral: 'tw:border-l-border-strong',
      success: 'tw:border-l-success',
      danger: 'tw:border-l-danger',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export type ToastMessage = VariantProps<typeof toastVariants> & {
  title: string;
  description?: string;
  /** One follow-up, retrying a failed save for one. */
  action?: { label: string; onAction: () => void };
};

type ShownToast = ToastMessage & { id: number; open: boolean };

/** Where code outside React, a `beforeLoad` or a mutation's `onError`, sends a toast. */
export type Toaster = {
  show: (message: ToastMessage) => void;
  subscribe: (listener: (message: ToastMessage) => void) => () => void;
};

/**
 * One per router, so a toast never reaches another request's page. A message sent before the
 * provider listens waits for it.
 */
export function createToaster(): Toaster {
  let listener: ((message: ToastMessage) => void) | undefined;
  const waiting: ToastMessage[] = [];

  return {
    show: (message) => {
      if (listener) listener(message);
      else waiting.push(message);
    },
    subscribe: (next) => {
      listener = next;
      for (const message of waiting.splice(0)) next(message);
      return () => {
        if (listener === next) listener = undefined;
      };
    },
  };
}

const ToastContext = createContext<((message: ToastMessage) => void) | undefined>(undefined);

export function useToast(): (message: ToastMessage) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used within ToastProvider');
  return show;
}

type ToastProps = Omit<ShownToast, 'id'> & {
  closeLabel: string;
  onClose: () => void;
};

function Toast({ variant, title, description, action, open, closeLabel, onClose }: ToastProps) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      open={open}
      onOpenChange={(stillOpen) => !stillOpen && onClose()}
      className={toastVariants({ variant })}
    >
      <ToastPrimitive.Title
        data-slot="toast-title"
        className="tw:col-start-1 tw:text-sm tw:font-medium"
      >
        {title}
      </ToastPrimitive.Title>
      {description && (
        <ToastPrimitive.Description
          data-slot="toast-description"
          className="tw:col-start-1 tw:text-sm tw:text-fg-muted"
        >
          {description}
        </ToastPrimitive.Description>
      )}
      {action && (
        <ToastPrimitive.Action altText={action.label} asChild>
          <Button
            size="sm"
            onClick={action.onAction}
            className="tw:col-start-2 tw:row-span-2 tw:row-start-1"
          >
            {action.label}
          </Button>
        </ToastPrimitive.Action>
      )}
      <ToastPrimitive.Close asChild>
        <IconButton size="sm" aria-label={closeLabel} className="tw:absolute tw:top-2 tw:right-2">
          <X aria-hidden="true" />
        </IconButton>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export type ToastProviderProps = PropsWithChildren<{
  toaster: Toaster;
  /** Names each toast's close button, which shows only an icon. */
  closeLabel: string;
}>;

/** Mounted once, at the root, showing what `toaster` and `useToast()` send. */
export function ToastProvider({ toaster, closeLabel, children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ShownToast[]>([]);
  const lastId = useRef(0);

  const show = useCallback((message: ToastMessage) => {
    lastId.current += 1;
    const id = lastId.current;
    setToasts((shown) => [...shown.filter((toast) => toast.open), { ...message, id, open: true }]);
  }, []);

  useEffect(() => toaster.subscribe(show), [toaster, show]);

  const close = (id: number) =>
    setToasts((shown) =>
      shown.map((toast) => (toast.id === id ? { ...toast, open: false } : toast))
    );

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      <ToastContext.Provider value={toaster.show}>{children}</ToastContext.Provider>
      {toasts.map(({ id, ...toast }) => (
        <Toast key={id} {...toast} closeLabel={closeLabel} onClose={() => close(id)} />
      ))}
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        className="tw:fixed tw:right-0 tw:bottom-0 tw:z-toast tw:m-0 tw:flex tw:max-h-dvh tw:w-full tw:list-none tw:flex-col tw:gap-2 tw:p-4 tw:outline-none tw:sm:max-w-sm"
      />
    </ToastPrimitive.Provider>
  );
}
