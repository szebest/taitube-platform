import { Direction, Toast as ToastPrimitive } from 'radix-ui';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '../button';
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastRoot,
  ToastTitle,
} from './toast';
import { toastStyles } from './toast.variants';
import type { ToastTone } from './types';

const MAX_SHOWN = 3;
const DURATION_MS = 5000;
const DURATION_WITH_ACTION_MS = 8000;

export type ToastMessage = {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** One follow-up, retrying a failed save for one. */
  action?: { label: string; onAction: () => void };
};

type ShownToast = ToastMessage & { id: number; open: boolean };

/**
 * Where code outside React, a `beforeLoad` or a mutation's `onError`, sends a toast. It covers client
 * navigation only: a server-side `beforeLoad` redirect is a 307 with no HTML, so a queued toast is lost
 * and the redirect carries its message itself (a search param the root reads, or a flash cookie).
 */
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

const ShowToastContext = createContext<((message: ToastMessage) => void) | undefined>(undefined);

export function useToast(): (message: ToastMessage) => void {
  const show = useContext(ShowToastContext);
  if (!show) throw new Error('useToast must be used within ToastProvider');
  return show;
}

export type ToastProviderProps = PropsWithChildren<{ toaster: Toaster }>;

/** Mounted once, at the root, showing what `toaster` and `useToast()` send. */
export function ToastProvider({ toaster, children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ShownToast[]>([]);
  const lastId = useRef(0);
  const swipeDirection = Direction.useDirection() === 'rtl' ? 'left' : 'right';

  const show = useCallback((message: ToastMessage) => {
    lastId.current += 1;
    const id = lastId.current;
    setToasts((shown) =>
      [...shown.filter((toast) => toast.open), { ...message, id, open: true }].slice(-MAX_SHOWN)
    );
  }, []);

  useEffect(() => toaster.subscribe(show), [toaster, show]);

  const close = (id: number) =>
    setToasts((shown) =>
      shown.map((toast) => (toast.id === id ? { ...toast, open: false } : toast))
    );

  return (
    <ToastPrimitive.Provider swipeDirection={swipeDirection}>
      <ShowToastContext value={toaster.show}>{children}</ShowToastContext>
      {toasts.map(({ id, open, tone, title, description, action }) => (
        <ToastRoot
          key={id}
          tone={tone}
          open={open}
          duration={action ? DURATION_WITH_ACTION_MS : DURATION_MS}
          onOpenChange={(stillOpen) => !stillOpen && close(id)}
        >
          <ToastIcon />
          <ToastTitle>{title}</ToastTitle>
          {description && <ToastDescription>{description}</ToastDescription>}
          {action && (
            <ToastAction altText={action.label} asChild>
              <Button size="sm" onClick={action.onAction}>
                {action.label}
              </Button>
            </ToastAction>
          )}
          <ToastClose />
        </ToastRoot>
      ))}
      <ToastPrimitive.Viewport data-slot="toast-viewport" className={toastStyles().viewport()} />
    </ToastPrimitive.Provider>
  );
}
