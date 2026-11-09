import { screen } from '@testing-library/react';
import { getRelatedVideos } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const RELATED_ID = '0190c3a0-5e1d-7000-8000-00000000a009';

const related = () =>
  mockEndpoint(getRelatedVideos, () =>
    HttpResponse.json({
      items: [
        {
          ...videoSummary({
            id: RELATED_ID,
            title: 'Tram ride',
            playbackUrl: 'http://localhost:9000/hls/master.m3u8',
          }),
          reason: { kind: 'co-watched' as const },
        },
      ],
    })
  );

describe('apps/client/web: watch stage in the browser', () => {
  it.each([
    { scenario: 'a start time', search: '?t=90', startTime: '90' },
    { scenario: 'no start time', search: '', startTime: null },
    { scenario: 'a start time that is not a number', search: '?t=soon', startTime: null },
  ])('hands the player ', async ({ search, startTime }) => {
    await renderWatch({ search });

    const player = screen.getByTestId('player');

    expect(player.getAttribute('data-start-time')).toBe(startTime);
  });

  it('widens the stage in theater mode and names it for the card the viewer came from', async () => {
    const { user } = await renderWatch();
    const stage = screen.getByRole('region', { name: 'Video player' });
    expect(stage).toHaveAttribute('data-variant', 'standard');
    expect(stage).toHaveStyle({ viewTransitionName: `video-${VIDEO_ID}` });

    await user.click(screen.getByRole('button', { name: 'Theater mode' }));

    expect(stage).toHaveAttribute('data-variant', 'theater');
  });

  it('plays the video it opens once the last one ends, and not one visited directly', async () => {
    const { user, router } = await renderWatch({ handlers: [related()] });
    await screen.findByRole('link', { name: 'Tram ride' });
    expect(screen.getByTestId('player')).toHaveAttribute('data-playing', 'false');

    await user.click(screen.getByRole('button', { name: 'End video' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${RELATED_ID}`));
    expect(await screen.findByTestId('player')).toHaveAttribute('data-playing', 'true');
  });
});
