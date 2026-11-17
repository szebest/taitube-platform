import { screen, waitFor, within } from '@testing-library/react';
import { account, creatorStats } from '@vp/web-testing';
import { stubSeek } from '#app/__tests__/stub-player';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: StatsRetention', () => {
  afterEach(() => {
    stubSeek.mockClear();
  });

  it('says how much of the video the average view watched', async () => {
    await renderPanel({ viewer: account() });

    expect(
      await screen.findByText('The average view watched 42% of the video')
    ).toBeInTheDocument();
  });

  it.each([
    { label: '00:42, 18% leave here', seconds: 42 },
    { label: '03:30, 9% leave here', seconds: 210 },
  ])(
    'plays the video from  seconds when "" is pressed, and brings the stage into view',
    async ({ label, seconds }) => {
      const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
      const { user } = await renderPanel({ viewer: account() });

      await user.click(await screen.findByRole('button', { name: label }));

      expect(stubSeek).toHaveBeenCalledWith(seconds);
      expect(scroll).toHaveBeenCalled();
    }
  );

  it('lays one marker on the strip for each drop-off', async () => {
    await renderPanel({ viewer: account() });
    const region = await screen.findByRole('region', { name: 'Retention' });

    await waitFor(() =>
      expect(region.querySelectorAll('[data-slot="retention-strip-marker"]')).toHaveLength(2)
    );
  });

  it('shows no drop-offs and no error for a video without retention data', async () => {
    await renderPanel({
      viewer: account(),
      stats: creatorStats({ retention: { average: null, dropOffs: [] } }),
    });

    expect(await screen.findByText('No retention data yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /leave here/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Creator stats' })).queryByText(
        'Where viewers leave'
      )
    ).not.toBeInTheDocument();
  });
});
