import { screen } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { writeCookie } from '@vp/ui';
import { channel, mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { attachedHls, parseMaster } from '#app/features/player/__tests__/offline-hls';
import { getRouter } from '#app/router';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const { id, handle, displayName, avatarUrl } = channel();

const WATCH_HANDLERS = [
  mockEndpoint(getVideo, () =>
    HttpResponse.json(
      video({
        title: 'Launch day',
        playbackUrl: 'http://localhost:9000/hls/master.m3u8',
        channel: { id, handle, displayName, avatarUrl },
      })
    )
  ),
  ...loaderApi(),
];

describe('apps/client/web: playback defaults honoured by the player', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('plays the next video at the speed and the quality chosen in settings', async () => {
    const { user, router } = await renderRoute(getRouter, '/settings/playback', {
      handlers: WATCH_HANDLERS,
    });
    await user.click(await screen.findByRole('combobox', { name: 'Default speed' }));
    await user.click(await screen.findByRole('option', { name: '1.5x' }));
    await user.click(screen.getByRole('combobox', { name: 'Default quality' }));
    await user.click(await screen.findByRole('option', { name: '480p' }));

    await router.navigate({ to: '/watch/$videoId', params: { videoId: VIDEO_ID } });
    const player = await screen.findByRole('group', { name: 'Media player' });
    const element = player.querySelector('video');
    if (!element) throw new Error('the player rendered no <video>');
    const hls = await attachedHls(element);
    const nextLevel = vi.spyOn(hls, 'nextLevel', 'set');
    await parseMaster(element, [480, 720, 1080], 1080);
    element.dispatchEvent(new Event('loadedmetadata'));

    expect(element.playbackRate).toBe(1.5);
    await vi.waitFor(() => expect(nextLevel).toHaveBeenLastCalledWith(0));
  });
});
