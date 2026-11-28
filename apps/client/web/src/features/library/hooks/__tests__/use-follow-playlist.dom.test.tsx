import { waitFor } from '@testing-library/react';
import { followPlaylist, unfollowPlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useFollowPlaylist } from '../use-follow-playlist';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const KEY = playlistQueryOptions(api, LIST).queryKey;
const NO_CONTENT = () => new HttpResponse<null>(null, { status: 204 });

function renderFollow(following: boolean, write: () => Response = NO_CONTENT) {
  const writes: string[] = [];
  apiServer.use(
    mockEndpoint(followPlaylist, () => {
      writes.push('follow');
      return write();
    }),
    mockEndpoint(unfollowPlaylist, () => {
      writes.push('unfollow');
      return write();
    })
  );
  const client = createQueryClient();
  const playlist = playlistDetail(LIST, [], { viewer: { role: null, following } });
  client.setQueryData(KEY, playlist);
  client.setQueryData(libraryKeys.followed(), { pages: [], pageParams: [] });
  const { result, show } = renderWithToasts(() => useFollowPlaylist(playlist), client);
  return { result, show, client, writes };
}

describe('apps/client/web: useFollowPlaylist', () => {
  it.each([true, false])('reads following %s from the playlist read', (following) => {
    expect(renderFollow(following).result.current.following).toBe(following);
  });

  it.each([
    { from: 'not following', following: false, write: 'follow' },
    { from: 'following', following: true, write: 'unfollow' },
  ])(
    'switches $from in the cached read and marks the followed list stale',
    async ({ following, write }) => {
      const { result, client, writes } = renderFollow(following);

      result.current.toggle();

      await waitFor(() => expect(client.getQueryData(KEY)?.viewer.following).toBe(!following));
      await waitFor(() => expect(writes).toEqual([write]));
      await waitFor(() =>
        expect(client.getQueryState(libraryKeys.followed())?.isInvalidated).toBe(true)
      );
    }
  );

  it('puts the follow back and says so when the server refuses', async () => {
    const { result, show, client, writes } = renderFollow(false, () =>
      problemReply(ErrorCodes.INTERNAL)
    );

    result.current.toggle();

    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }))
    );
    expect(writes).toEqual(['follow']);
    expect(client.getQueryData(KEY)?.viewer.following).toBe(false);
  });
});
