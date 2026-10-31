import { renderHook } from '@testing-library/react';
import { ToastProvider } from '@vp/ui';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';

import { useChangeFailed } from '../use-change-failed';

describe('apps/client/web: useChangeFailed', () => {
  it('toasts that the change could not be saved, in the danger tone', () => {
    const show = vi.fn();
    const toaster = { show, subscribe: () => () => undefined };
    const { result } = renderHook(useChangeFailed, {
      wrapper: ({ children }: PropsWithChildren) => (
        <AppProviders>
          <ToastProvider toaster={toaster}>{children}</ToastProvider>
        </AppProviders>
      ),
    });

    result.current(new Error('refused'));

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', title: 'That change could not be saved' })
    );
  });
});
