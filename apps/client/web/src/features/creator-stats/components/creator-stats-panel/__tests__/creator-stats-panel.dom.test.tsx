import { screen } from '@testing-library/react';
import { membershipOn, viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const TEAMMATE = '0190c3a0-5e1d-7000-8000-00000000b00a';

describe('apps/client/web: CreatorStatsPanel', () => {
  it.each([
    { who: 'a signed-in stranger', viewer: viewerAccount(TEAMMATE), memberships: [] },
    {
      who: 'a moderator of the channel',
      viewer: viewerAccount(TEAMMATE),
      memberships: [membershipOn('moderator')],
    },
    { who: 'a guest', viewer: undefined, memberships: [] },
  ])('shows $who no panel and asks for nothing', async ({ viewer, memberships }) => {
    const { requests } = await renderPanel({ viewer, memberships });

    expect(screen.queryByRole('region', { name: 'Creator stats' })).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});
