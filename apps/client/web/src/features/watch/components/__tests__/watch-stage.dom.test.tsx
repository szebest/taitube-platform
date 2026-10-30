import { screen } from '@testing-library/react';

import { VIDEO_ID } from '@vp/web-testing';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

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
});
