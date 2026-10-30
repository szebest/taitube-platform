import { act, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

function connection(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

async function openLive() {
  vi.stubGlobal('caches', undefined);
  return renderRoute(getRouter, '/live', { handlers: loaderApi() });
}

describe('apps/client/web: OfflineBanner', () => {
  it('shows nothing while online', async () => {
    await openLive();

    expect(screen.queryByRole('status', { name: '' })).not.toBeInTheDocument();
    expect(screen.queryByText('You are offline')).not.toBeInTheDocument();
  });

  it('announces the drop with a banner and a toast, then confirms the reconnection and clears itself', async () => {
    await openLive();

    connection(false);

    const banner = document.querySelector('[data-slot="offline-state"][data-size="banner"]');
    expect(banner).toHaveTextContent('You are offline');
    expect(banner).toHaveAttribute('role', 'status');
    expect(
      await screen.findByText('The feed you already loaded stays available.')
    ).toBeInTheDocument();

    connection(true);

    expect(screen.getByText('Back online').closest('[data-tone="success"]')).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('Back online')).not.toBeInTheDocument(), {
      timeout: 6000,
    });
  });
});
