import { axeViolations } from '@kit/web-testing/dom';
import { act, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { loaderApi } from '#app/__tests__/loader-api';
import { SYNC_CHANNEL } from '#app/integrations/service-worker/sync-messages';
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

  it('announces the drop with a banner and a toast, then confirms the reconnection', async () => {
    await openLive();

    connection(false);

    const banner = document.querySelector('[data-slot="offline-state"][data-size="banner"]');
    expect(banner).toHaveTextContent('You are offline');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner?.querySelector('[data-slot="offline-state-description"]')).toBeNull();
    expect(
      await screen.findByText('The feed you already loaded stays available.')
    ).toBeInTheDocument();

    connection(true);

    expect(screen.getByText('Back online').closest('[data-tone="success"]')).not.toBeNull();
    await waitFor(() =>
      expect(
        screen.queryByText('The feed you already loaded stays available.')
      ).not.toBeInTheDocument()
    );
  });

  it('shows the queued count from medium up and keeps it in the status region below', async () => {
    await openLive();
    connection(false);

    const worker = new BroadcastChannel(SYNC_CHANNEL);
    worker.postMessage({ type: 'pending', pending: 2 });
    worker.close();

    const count = await screen.findByText('2 changes will sync when the connection returns.');
    expect(count).toBeVisible();
    expect(count).toHaveClass('sr-only', 'medium:not-sr-only', 'medium:truncate');
    expect(count).not.toHaveClass('hidden');
    expect(count.closest('[role="status"]')).toHaveAttribute('data-size', 'banner');
    expect(await axeViolations()).toEqual([]);
  });
});
