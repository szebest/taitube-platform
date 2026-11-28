import { screen, waitFor } from '@testing-library/react';
import { freezePlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { seated, seatedAs } from '#app/features/library/__tests__/playlist-people';
import {
  chooseFromMore,
  renderPlaylist,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';

const RULES = { match: 'all' as const, conditions: [], sort: 'newest' as const, limit: 50 };
const FROZEN = uuid(4500);

describe('apps/client/web: the playlist More menu', () => {
  it.each([
    {
      viewer: 'the owner of a smart playlist',
      overrides: { rules: RULES },
      items: [
        'Collaborators',
        'Activity',
        'Share links',
        'Stats',
        'Settings',
        'Edit rules',
        'Freeze',
        'Edit details',
        'Delete playlist',
      ],
    },
    {
      viewer: 'the owner of Watch later',
      overrides: { isSystem: true },
      items: ['Collaborators', 'Activity', 'Stats', 'Settings'],
    },
    {
      viewer: 'an editor',
      overrides: seatedAs('editor'),
      seat: 'editor' as const,
      items: ['Collaborators', 'Activity', 'Edit details', 'Leave playlist'],
    },
  ])('offers $viewer what they may do', async ({ overrides, seat, items }) => {
    const { user } = await renderPlaylist(overrides, [seated([], seat)]);

    await user.click(await screen.findByRole('button', { name: 'More playlist actions' }));

    await waitFor(() =>
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(items)
    );
  });

  it('freezes a smart playlist into a new one and opens it', async () => {
    const { user, router } = await renderPlaylist({ rules: RULES }, [
      mockEndpoint(freezePlaylist, () =>
        HttpResponse.json(playlistDetail(FROZEN, VIDEOS, { title: 'Snapshot' }), { status: 201 })
      ),
    ]);

    await chooseFromMore(user, 'Freeze');

    expect(await screen.findByText('Saved what it holds now as Snapshot')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toMatchObject({ list: FROZEN }));
  });
});
