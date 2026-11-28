import { mergePlaylists } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useMergePlaylists } from '../use-merge-playlists';
import { renderWithToasts } from './toast-harness';

type PlaylistMerge = Parameters<ReturnType<typeof useMergePlaylists>['mutate']>[0];

const SOURCES = [uuid(4101), uuid(4102)];
const INTO = uuid(4100);

describe('apps/client/web: useMergePlaylists', () => {
  it.each<{ target: string; merge: PlaylistMerge; body: object }>([
    {
      target: 'an existing playlist',
      merge: { kind: 'into', into: INTO, sourceIds: SOURCES, deleteSources: false },
      body: { sourceIds: SOURCES, deleteSources: false, into: INTO },
    },
    {
      target: 'a new playlist',
      merge: { kind: 'new', newTitle: 'All trips', sourceIds: SOURCES, deleteSources: true },
      body: { sourceIds: SOURCES, deleteSources: true, newTitle: 'All trips' },
    },
  ])('names $target and marks the playlists stale', async ({ merge, body }) => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(mergePlaylists, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({ playlistId: INTO, results: [] });
      })
    );
    const client = createQueryClient();
    client.setQueryData(libraryKeys.playlists(), { items: [] });
    const { result } = renderWithToasts(useMergePlaylists, client);

    await result.current.mutateAsync(merge);

    expect(bodies).toEqual([body]);
    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
  });
});
