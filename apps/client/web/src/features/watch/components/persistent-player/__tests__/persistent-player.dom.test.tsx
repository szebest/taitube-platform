import { screen, within } from '@testing-library/react';
import { getClip } from '@vp/api-contracts';
import { CLIP_ID, clip, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: the persistent player', () => {
  it('pauses the session player when a page with a player of its own opens', async () => {
    const { user, router } = await renderWatch({
      handlers: [mockEndpoint(getClip, () => HttpResponse.json(clip()))],
    });
    await user.click(screen.getByRole('button', { name: 'Start playing' }));
    expect(screen.getByTestId('player')).toHaveAttribute('data-playing', 'true');

    await router.navigate({ to: '/clip/$clipId', params: { clipId: CLIP_ID } });

    const bar = await screen.findByRole('region', { name: 'Now playing' });
    await vi.waitFor(() =>
      expect(within(bar).getByTestId('player')).toHaveAttribute('data-playing', 'false')
    );
  });
});
