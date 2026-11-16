import { act, screen, waitFor, within } from '@testing-library/react';
import { getCreatorStats } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { videoKeys } from '@vp/queries';
import { account, creatorStats, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { membershipOn, viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const STATS_PATH = `/v1/videos/${VIDEO_ID}/creator-stats`;
const TEAMMATE = '0190c3a0-5e1d-7000-8000-00000000b00a';

const panel = () => screen.findByRole('region', { name: 'Creator stats' });
const actions = () => screen.queryByRole('group', { name: 'Quick actions' });

describe('apps/client/web: StatsPanel', () => {
  it('shows the owner the numbers with the lock and the live indicator, in an accessible panel', async () => {
    const { requests } = await renderPanel({ viewer: account() });

    const region = await panel();
    await within(region).findByText('1.2K');

    expect(within(region).getByText('Only you and your team see this')).toBeInTheDocument();
    expect(within(region).getByText('Updating live')).toBeInTheDocument();
    expect(within(region).getByText('00:45')).toBeInTheDocument();
    expect(requests).toEqual([STATS_PATH]);
    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    {
      who: 'a manager',
      role: 'manager' as const,
      shown: ['Edit title', 'Thumbnail', 'Pin a comment'],
    },
    { who: 'an editor', role: 'editor' as const, shown: ['Edit title', 'Thumbnail'] },
    { who: 'an analytics viewer', role: 'analytics' as const, shown: [] },
  ])('shows $who the panel and the actions their role carries', async ({ role, shown }) => {
    await renderPanel({ viewer: viewerAccount(TEAMMATE), memberships: [membershipOn(role)] });

    await within(await panel()).findByText('1.2K');

    const group = actions();
    const names = group
      ? within(group)
          .queryAllByRole('button')
          .map((button) => button.textContent)
      : [];
    expect(names).toEqual(shown);
  });

  it('says nothing is live once the first 48 hours are over, and offers only the 30 days', async () => {
    await renderPanel({ viewer: account(), stats: creatorStats({ first48Hours: null }) });

    const region = await panel();
    await within(region).findByText('1.2K');

    expect(within(region).queryByText('Updating live')).not.toBeInTheDocument();
    expect(within(region).queryByRole('radio', { name: 'First 48 hours' })).not.toBeInTheDocument();
  });

  it('collapses to its header and opens again', async () => {
    const { user } = await renderPanel({ viewer: account() });
    const region = await panel();
    await within(region).findByText('1.2K');

    await user.click(within(region).getByRole('button', { name: 'Hide stats' }));

    expect(within(region).queryByText('1.2K')).not.toBeVisible();
    await user.click(within(region).getByRole('button', { name: 'Show stats' }));
    expect(within(region).getByText('1.2K')).toBeVisible();
  });

  it('links to the studio analytics of the video', async () => {
    await renderPanel({ viewer: account() });

    const link = await within(await panel()).findByRole('link', { name: 'Open full analytics' });

    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`/videos/${VIDEO_ID}/analytics$`))
    );
  });

  it('fails in its own section with a retry, and the rest of the page stays', async () => {
    let failing = true;
    const { user } = await renderPanel({
      viewer: account(),
      handlers: [
        mockEndpoint(getCreatorStats, () =>
          failing ? problemReply(ErrorCodes.INTERNAL) : HttpResponse.json(creatorStats())
        ),
      ],
    });

    const alert = await within(await panel()).findByRole('alert');
    expect(within(alert).getByText('The stats could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Launch day' })).toBeInTheDocument();

    failing = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await within(await panel()).findByText('1.2K')).toBeInTheDocument();
  });

  it('refetches when the stats query of the video is invalidated, which is what video.stats.updated does', async () => {
    let views = 1_200;
    const { queryClient } = await renderPanel({
      viewer: account(),
      handlers: [
        mockEndpoint(getCreatorStats, () =>
          HttpResponse.json(creatorStats({ last30Days: { ...creatorStats().last30Days, views } }))
        ),
      ],
    });
    const region = await panel();
    await within(region).findByText('1.2K');

    views = 3_400;
    await act(() => queryClient.invalidateQueries({ queryKey: videoKeys.creatorStats(VIDEO_ID) }));

    await waitFor(() => expect(within(region).getByText('3.4K')).toBeInTheDocument());
  });
});
