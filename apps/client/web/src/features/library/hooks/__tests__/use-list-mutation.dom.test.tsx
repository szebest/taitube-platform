import { createQueryClient } from '@vp/queries';
import { ToastProvider } from '@vp/ui';
import { renderMutation } from '@vp/web-testing/dom';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';

import { useListMutation } from '../use-list-mutation';

function setup(mutationFn: () => Promise<unknown>, onError = vi.fn()) {
  const show = vi.fn();
  const toaster = { show, subscribe: () => () => undefined };
  const Providers = ({ children }: PropsWithChildren) => (
    <AppProviders>
      <ToastProvider toaster={toaster}>{children}</ToastProvider>
    </AppProviders>
  );
  const result = renderMutation(
    () => useListMutation({ mutationFn, onError }),
    createQueryClient(),
    Providers
  );
  return { result, show, onError };
}

describe('apps/client/web: useListMutation', () => {
  it('runs the options’ own rollback, then toasts, when the request fails', async () => {
    const { result, show, onError } = setup(() => Promise.reject(new Error('refused')));

    await result.current.mutateAsync(undefined).catch(() => undefined);

    expect(onError).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', title: 'That change could not be saved' })
    );
  });

  it('says nothing when the request succeeds', async () => {
    const { result, show, onError } = setup(() => Promise.resolve(null));

    await result.current.mutateAsync(undefined);

    expect(onError).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });
});
