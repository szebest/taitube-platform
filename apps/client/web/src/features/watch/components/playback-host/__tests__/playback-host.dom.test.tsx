import { screen, within } from '@testing-library/react';
import { getClip } from '@vp/api-contracts';
import { CLIP_ID, clip, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { renderWatch } from '#app/__tests__/render-watch';
import { getRouter } from '#app/router';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const sessionPlayer = () =>
  document.querySelector('[data-slot=playback-host] [data-testid=player]');

describe('apps/client/web: the playback host', () => {
  it('mounts no player while nothing plays', async () => {
    await renderRoute(getRouter, '/', { handlers: loaderApi() });
    await screen.findByRole('banner');

    expect(document.querySelectorAll('[data-slot=playback-host]')).toHaveLength(0);
    expect(document.querySelectorAll('video')).toHaveLength(0);
  });

  it('pauses the session player when a page with a player of its own opens', async () => {
    const { user, router } = await renderWatch({
      handlers: [mockEndpoint(getClip, () => HttpResponse.json(clip()))],
    });
    await user.click(screen.getByRole('button', { name: 'Start playing' }));
    expect(sessionPlayer()).toHaveAttribute('data-playing', 'true');

    await router.navigate({ to: '/clip/$clipId', params: { clipId: CLIP_ID } });

    await screen.findByRole('region', { name: 'Now playing' });
    await vi.waitFor(() => expect(sessionPlayer()).toHaveAttribute('data-playing', 'false'));
  });

  it('closes with the player: nothing is left mounted once the viewer closes the mini player', async () => {
    const { user, router } = await renderWatch();
    await router.navigate({ to: '/' });
    const bar = await screen.findByRole('region', { name: 'Now playing' });

    await user.click(within(bar).getByRole('button', { name: 'Close' }));

    expect(document.querySelectorAll('[data-slot=playback-host]')).toHaveLength(0);
    expect(document.querySelectorAll('video')).toHaveLength(0);
  });
});
