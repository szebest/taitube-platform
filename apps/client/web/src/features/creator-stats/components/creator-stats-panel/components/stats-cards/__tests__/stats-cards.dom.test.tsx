import { screen, within } from '@testing-library/react';
import { account, creatorStats } from '@vp/web-testing';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const cardOf = async (label: string) => {
  const caption = await screen.findByText(label, { selector: 'figcaption' });
  return within(caption.closest('figure') as HTMLElement);
};

describe('apps/client/web: StatsCards', () => {
  it.each([
    { label: 'Views', value: '1.2K' },
    { label: 'Watch time', value: '15:00:00' },
    { label: 'Average view duration', value: '00:45' },
    { label: 'Likes', value: '24' },
    { label: 'Comments', value: '6' },
    { label: 'Subscribers gained', value: '3' },
  ])('shows  as ', async ({ label, value }) => {
    await renderPanel({ viewer: account() });

    expect((await cardOf(label)).getByText(value)).toBeInTheDocument();
  });

  it('shows what the endpoint answers, so a quiet video reads as zeros', async () => {
    const quiet = creatorStats({
      lifetime: { views: 0, watchSeconds: 0, likes: 0, comments: 0, subscribersGained: 0 },
      last30Days: { views: 0, watchSeconds: 0, averageViewDurationSeconds: 0, daily: [] },
    });
    await renderPanel({ viewer: account(), stats: quiet });

    expect((await cardOf('Views')).getByText('0')).toBeInTheDocument();
    expect((await cardOf('Average view duration')).getByText('00:00')).toBeInTheDocument();
  });
});
