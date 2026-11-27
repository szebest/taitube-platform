import { unfollowPlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useUnfollowPlaylist } from '../use-unfollow-playlist';
import { renderWithToasts } from './toast-harness';

describe('apps/client/web: useUnfollowPlaylist', () => {
  it('unfollows the playlist and marks the followed list stale', async () => {
    const unfollowed: string[] = [];
    apiServer.use(
      mockEndpoint(unfollowPlaylist, ({ params }) => {
        unfollowed.push(String(params.id));
        return new HttpResponse<null>(null, { status: 204 });
      })
    );
    const client = createQueryClient();
    client.setQueryData(libraryKeys.followed(), { pages: [], pageParams: [] });
    const { result } = renderWithToasts(useUnfollowPlaylist, client);

    await result.current.mutateAsync(uuid(4100));

    expect(unfollowed).toEqual([uuid(4100)]);
    expect(client.getQueryState(libraryKeys.followed())?.isInvalidated).toBe(true);
  });
});
