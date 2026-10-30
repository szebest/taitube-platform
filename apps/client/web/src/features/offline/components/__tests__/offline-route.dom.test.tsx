import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';
import { CACHE_NAMES } from '#app/sw/cache-names';

function openOffline(held: string[]) {
  vi.stubGlobal('caches', {
    has: async (name: string) => name === CACHE_NAMES.api && held.length > 0,
    open: async () => ({ keys: async () => held }),
  });
  return renderRoute(getRouter, '/offline', { handlers: loaderApi() });
}

describe('apps/client/web: OfflineRoute', () => {
  it('says what is unavailable and offers the way back to Home', async () => {
    await openOffline([]);

    expect(screen.getByRole('heading', { name: 'You are offline' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Available offline')).not.toBeInTheDocument();
  });

  it('lists the cached feed with its count', async () => {
    await openOffline(['a', 'b']);

    expect(await screen.findByText('Available offline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Feed\s*2 pages/ })).toHaveAttribute('href', '/');
  });

  it.each([
    { name: 'goes home when the connection answers', ok: true, assigned: 1 },
    { name: 'stays and says it is still offline when it does not', ok: false, assigned: 0 },
  ])('retry $name', async ({ ok, assigned }) => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: ok ? 200 : 503 }))
    );
    const { user } = await openOffline([]);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(assigned));
    if (!ok) {
      expect(await screen.findByText('Still offline')).toBeInTheDocument();
    }
  });
});
