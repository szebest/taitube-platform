import type { QueryClient } from '@tanstack/react-query';
import { ToastProvider } from '@vp/ui';
import { renderMutation } from '@vp/web-testing/dom';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';

export function renderWithToasts<T>(hook: () => T, client: QueryClient) {
  const show = vi.fn();
  const toaster = { show, subscribe: () => () => undefined };
  const Providers = ({ children }: PropsWithChildren) => (
    <AppProviders>
      <ToastProvider toaster={toaster}>{children}</ToastProvider>
    </AppProviders>
  );
  return { result: renderMutation(hook, client, Providers), show };
}
