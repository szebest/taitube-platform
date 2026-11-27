import { screen, waitFor } from '@testing-library/react';
import {
  type FollowedPlaylistView,
  followPlaylist,
  forkPlaylist,
  pinPlaylist,
  unfollowPlaylist,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { NOW, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { loaderApi } from '#app/__tests__/loader-api';
import { STRANGER_OWNER } from '#app/features/library/__tests__/playlist-people';
import { libraryApi, renderLibrary } from '#app/features/library/__tests__/render-library';
import {
  LAZY,
  LIST,
  renderPlaylist,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';
import { getRouter } from '#app/router';

const SOMEONE_ELSES = { ownerId: STRANGER_OWNER, visibility: 'public' as const };
const FORK = uuid(4200);
const FOLLOWED: FollowedPlaylistView = { playlistId: LIST, followedAt: NOW, playlist: null };

/** Someone else's public playlist; `followed` says whether the viewer follows it, `writes` collects each write. */
async function renderTheirs(followed: boolean) {
  const writes: string[] = [];
  const noContent = (write: string) => () => {
    writes.push(write);
    return new HttpResponse<null>(null, { status: 204 });
  };
  const rendered = await renderLibrary(`/playlist?list=${LIST}`, {
    details: [
      playlistDetail(LIST, VIDEOS, SOMEONE_ELSES),
      playlistDetail(FORK, VIDEOS, { title: 'Road trips (copy)' }),
    ],
    followed: followed ? [FOLLOWED] : [],
    handlers: [
      mockEndpoint(followPlaylist, noContent('follow')),
      mockEndpoint(unfollowPlaylist, noContent('unfollow')),
      mockEndpoint(forkPlaylist, () => {
        writes.push('fork');
        return HttpResponse.json(playlistDetail(FORK, VIDEOS, { title: 'Road trips (copy)' }), {
          status: 201,
        });
      }),
    ],
  });
  return { ...rendered, writes };
}

describe('apps/client/web: the playlist hero actions', () => {
  it('shows a guest Follow and Fork, and asks them to sign in on Follow', async () => {
    const { user } = await renderRoute(getRouter, `/playlist?list=${LIST}`, {
      handlers: [
        ...libraryApi({ details: [playlistDetail(LIST, VIDEOS, SOMEONE_ELSES)] }),
        ...loaderApi(),
      ],
    });

    expect(await screen.findByRole('button', { name: 'Fork' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Follow' }));

    expect(
      await screen.findByRole('dialog', { name: 'Sign in to add this to a playlist' }, LAZY)
    ).toBeInTheDocument();
  });

  it.each([
    { followed: false, button: 'Follow', write: 'follow', after: 'Following' },
    { followed: true, button: 'Following', write: 'unfollow', after: 'Follow' },
  ])('switches $button to $after', async ({ followed, button, write, after }) => {
    const { user, writes } = await renderTheirs(followed);

    await user.click(await screen.findByRole('button', { name: button }));

    expect(await screen.findByRole('button', { name: after })).toBeInTheDocument();
    expect(writes).toEqual([write]);
  });

  it('forks into a playlist of the viewer and opens it', async () => {
    const { user, writes, router } = await renderTheirs(false);

    await user.click(await screen.findByRole('button', { name: 'Fork' }));

    expect(await screen.findByText('Your copy Road trips (copy) is ready')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toMatchObject({ list: FORK }));
    expect(writes).toEqual(['fork']);
  });

  it.each([
    {
      outcome: 'pins it',
      reply: () => new HttpResponse<null>(null, { status: 204 }),
      says: 'Pinned to your library',
    },
    {
      outcome: 'says why a full set of pins refused it',
      reply: () => problemReply(ErrorCodes.PLAYLIST_PIN_LIMIT),
      says: 'You have pinned the most playlists you can. Unpin one first.',
    },
  ])('$outcome for the owner', async ({ reply, says }) => {
    const { user } = await renderPlaylist({}, [mockEndpoint(pinPlaylist, reply)]);

    await user.click(await screen.findByRole('button', { name: 'Pin to library' }));

    expect(await screen.findByText(says)).toBeInTheDocument();
  });

  it.each([
    { viewer: 'the owner', render: () => renderPlaylist(), missing: 'Follow' },
    { viewer: 'someone else', render: () => renderTheirs(false), missing: 'Pin to library' },
  ])('offers $viewer no $missing', async ({ render, missing }) => {
    await render();

    await screen.findByRole('button', { name: 'Fork' });

    expect(screen.queryByRole('button', { name: missing })).not.toBeInTheDocument();
  });
});
