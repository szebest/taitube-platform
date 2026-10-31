import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@vp/ui';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';

import { useCopyLink } from '../use-copy-link';

const LINK = 'http://localhost:3000/playlist?list=1';

function renderCopyLink() {
  userEvent.setup();
  const show = vi.fn();
  const toaster = { show, subscribe: () => () => undefined };
  const { result } = renderHook(useCopyLink, {
    wrapper: ({ children }: PropsWithChildren) => (
      <AppProviders>
        <ToastProvider toaster={toaster}>{children}</ToastProvider>
      </AppProviders>
    ),
  });
  return { copy: result.current, show };
}

describe('apps/client/web: useCopyLink', () => {
  it('copies the link and says so', async () => {
    const { copy, show } = renderCopyLink();

    await copy(LINK);

    expect(await navigator.clipboard.readText()).toBe(LINK);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'Link copied' })
    );
  });

  it('says so when the clipboard refuses', async () => {
    const { copy, show } = renderCopyLink();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await copy(LINK);

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', title: 'The link could not be copied' })
    );
  });
});
