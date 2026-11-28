import { screen, waitFor, within } from '@testing-library/react';
import { getPlaylistStats } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { seated, seatedAs } from '#app/features/library/__tests__/playlist-people';
import {
  chooseFromMore,
  LAZY,
  renderPlaylist,
} from '#app/features/library/__tests__/render-playlist';
import { LazyStatsSheet } from '#app/features/library/components/stats-sheet/stats-sheet.lazy';

const STATS = {
  from: '2026-02-09',
  to: '2026-03-10',
  opens: 1200,
  plays: 340,
  follows: 12,
  forks: 3,
  topItems: [{ videoId: uuid(1), title: 'Tram ride', plays: 210 }],
};

function statsAsked() {
  const ranges: (string | null)[] = [];
  const handler = mockEndpoint(getPlaylistStats, ({ request }) => {
    ranges.push(new URL(request.url).searchParams.get('range'));
    return HttpResponse.json(STATS);
  });
  return { ranges, handler };
}

beforeAll(() => LazyStatsSheet.preload());

describe('apps/client/web: the playlist stats sheet', () => {
  it('shows the owner the counts and the most played videos, and reads another range', async () => {
    const { ranges, handler } = statsAsked();
    const { user, router } = await renderPlaylist({}, [handler]);

    await chooseFromMore(user, 'Stats');
    const sheet = within(await screen.findByRole('dialog', { name: 'Playlist stats' }, LAZY));

    expect(await sheet.findByText('1,200')).toBeInTheDocument();
    expect(sheet.getByText('Page opens')).toBeInTheDocument();
    expect(sheet.getByText('Tram ride')).toBeInTheDocument();
    expect(sheet.getByText('210 plays')).toBeInTheDocument();

    await user.click(sheet.getByRole('radio', { name: '7 days' }));

    await waitFor(() => expect(ranges).toEqual(['30d', '7d']));
    expect(router.state.location.search).toMatchObject({ modal: 'playlist-stats', range: '7d' });
  });

  it('is not offered to a collaborator', async () => {
    const { ranges, handler } = statsAsked();
    const { user } = await renderPlaylist(seatedAs('editor'), [seated([], 'editor'), handler]);

    await user.click(await screen.findByRole('button', { name: 'More playlist actions' }));

    expect(await screen.findByRole('menuitem', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Stats' })).not.toBeInTheDocument();
    expect(ranges).toEqual([]);
  });
});
