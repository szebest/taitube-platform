import { VitePWA } from 'vite-plugin-pwa';
import { pwaPlugins } from '../../vite-pwa.config';

vi.mock(import('vite-plugin-pwa'), () => ({ VitePWA: vi.fn(() => []) }));

describe('web: vite-pwa.config', () => {
  it('builds the service worker to the target the client build compiles to', async () => {
    await pwaPlugins(['chrome124', 'safari17.4']);

    expect(vi.mocked(VitePWA)).toHaveBeenCalledWith(
      expect.objectContaining({
        injectManifest: expect.objectContaining({ target: ['chrome124', 'safari17.4'] }),
      })
    );
  });
});
