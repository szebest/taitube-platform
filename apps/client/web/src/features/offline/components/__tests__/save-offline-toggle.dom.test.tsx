import { screen, waitFor } from '@testing-library/react';
import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { supportOffline } from '#app/__tests__/offline-support';
import { renderWatch } from '#app/features/watch/__tests__/render-watch';
import { CACHE_NAMES } from '#app/sw/cache-names';
import {
  cdnHandlers,
  LOW_URL,
  savableVideo,
} from '#app/features/offline/saved/__tests__/saved-fixtures';

vi.mock(import('#app/features/pwa/register-service-worker'), () => ({
  registerServiceWorker: () => () => {},
}));
vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const { id: _id, ...savable } = savableVideo();

describe('apps/client/web: SaveOfflineToggle', () => {
  it('is absent where the browser cannot keep videos offline', async () => {
    vi.stubGlobal('caches', undefined);

    await renderWatch({ video: savable, handlers: cdnHandlers() });

    expect(screen.queryByRole('button', { name: 'Save for offline' })).not.toBeInTheDocument();
  });

  it('saves the video, says so, and flips to the saved state', async () => {
    const storage = fakeCacheStorage();
    supportOffline(storage);
    const { user } = await renderWatch({ video: savable, handlers: cdnHandlers() });

    await user.click(await screen.findByRole('button', { name: 'Save for offline' }));

    expect(
      await screen.findByText('Saved for offline', { selector: '[data-slot="toast-title"]' })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Saved for offline', pressed: true })
    ).toBeInTheDocument();
    expect(storage.held(CACHE_NAMES.saved)).toContain(LOW_URL);
  });

  it('tells the viewer when there is no room', async () => {
    supportOffline(
      fakeCacheStorage({ failPut: () => new DOMException('full', 'QuotaExceededError') })
    );
    const { user } = await renderWatch({ video: savable, handlers: cdnHandlers() });

    await user.click(await screen.findByRole('button', { name: 'Save for offline' }));

    expect(
      await screen.findByText('There is not enough storage on this device to save this video.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save for offline' })).toBeEnabled()
    );
  });
});
