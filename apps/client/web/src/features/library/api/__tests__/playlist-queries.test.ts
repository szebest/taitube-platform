import type { QueryClient } from '@tanstack/react-query';
import {
  getPlaylistStats,
  listFollowedPlaylists,
  listPlaylistActivity,
  listPlaylistCollaborators,
  listPlaylistInvites,
  listPlaylistItems,
  listPlaylistShareLinks,
} from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import {
  followedPlaylistIdsQueryOptions,
  followedPlaylistsQueryOptions,
  playlistActivityQueryOptions,
  playlistCollaboratorsQueryOptions,
  playlistInvitesQueryOptions,
  playlistShareLinksQueryOptions,
  playlistStatsQueryOptions,
  sortedPlaylistItemsQueryOptions,
} from '../playlist-queries';

const LIST = uuid(4100);

/** Answers keyset pages: a first page that points at `next`, then a last one. */
function keysetPages(items: (cursor: string | null) => unknown[] = () => []) {
  const asked: string[] = [];
  const reply = ({ request }: { request: Request }) => {
    const { searchParams } = new URL(request.url);
    asked.push(searchParams.toString());
    const cursor = searchParams.get('cursor');
    return HttpResponse.json({ items: items(cursor), nextCursor: cursor ? null : 'next' } as never);
  };
  return { asked, reply };
}

describe('apps/client/web: playlist queries', () => {
  it.each([
    {
      name: 'the activity',
      contract: listPlaylistActivity,
      fetch: (client: QueryClient) =>
        client.infiniteQuery({ ...playlistActivityQueryOptions(api, LIST), pages: 2 }),
    },
    {
      name: 'the followed playlists',
      contract: listFollowedPlaylists,
      fetch: (client: QueryClient) =>
        client.infiniteQuery({ ...followedPlaylistsQueryOptions(api), pages: 2 }),
    },
    {
      name: 'the items in another order',
      contract: listPlaylistItems,
      fetch: (client: QueryClient) =>
        client.infiniteQuery({ ...sortedPlaylistItemsQueryOptions(api, LIST, 'added'), pages: 2 }),
    },
  ])('reads $name a keyset page at a time', async ({ contract, fetch }) => {
    const { asked, reply } = keysetPages();
    apiServer.use(mockEndpoint(contract, reply as never));

    await fetch(createQueryClient());

    expect(asked.map((query) => query.replace(/^sort=added&/, ''))).toEqual([
      'limit=30',
      'limit=30&cursor=next',
    ]);
  });

  it('walks every followed page for the ids a Follow button reads', async () => {
    const { asked, reply } = keysetPages((cursor) => [
      { playlistId: cursor ? uuid(2) : uuid(1), followedAt: NOW, playlist: null },
    ]);
    apiServer.use(mockEndpoint(listFollowedPlaylists, reply as never));

    const ids = await createQueryClient().query(followedPlaylistIdsQueryOptions(api));

    expect(ids).toEqual([uuid(1), uuid(2)]);
    expect(asked).toHaveLength(2);
  });

  it('asks for the stats over the range and keeps each range apart', async () => {
    const ranges: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(getPlaylistStats, ({ request }) => {
        ranges.push(new URL(request.url).searchParams.get('range'));
        return HttpResponse.json({
          from: '2026-03-01',
          to: '2026-03-07',
          opens: 0,
          plays: 0,
          follows: 0,
          forks: 0,
          topItems: [],
        });
      })
    );

    await createQueryClient().query(playlistStatsQueryOptions(api, LIST, '7d'));

    expect(ranges).toEqual(['7d']);
    expect(playlistStatsQueryOptions(api, LIST, '7d').queryKey).not.toEqual(
      playlistStatsQueryOptions(api, LIST, '90d').queryKey
    );
  });

  it.each([
    {
      name: 'collaborators',
      contract: listPlaylistCollaborators,
      fetch: (client: QueryClient) => client.query(playlistCollaboratorsQueryOptions(api, LIST)),
    },
    {
      name: 'invites',
      contract: listPlaylistInvites,
      fetch: (client: QueryClient) => client.query(playlistInvitesQueryOptions(api, LIST)),
    },
    {
      name: 'share links',
      contract: listPlaylistShareLinks,
      fetch: (client: QueryClient) => client.query(playlistShareLinksQueryOptions(api, LIST)),
    },
  ])('reads the $name of the playlist', async ({ contract, fetch }) => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(contract, ({ params }) => {
        asked.push(String(params.id));
        return HttpResponse.json({ items: [] });
      })
    );

    await fetch(createQueryClient());

    expect(asked).toEqual([LIST]);
  });

  it('keys every part under the playlist, so one invalidation reaches them all', () => {
    const parts = [
      playlistCollaboratorsQueryOptions(api, LIST).queryKey,
      playlistInvitesQueryOptions(api, LIST).queryKey,
      playlistActivityQueryOptions(api, LIST).queryKey,
      playlistShareLinksQueryOptions(api, LIST).queryKey,
      playlistStatsQueryOptions(api, LIST, '30d').queryKey,
      sortedPlaylistItemsQueryOptions(api, LIST, 'duration').queryKey,
    ];
    const playlist = libraryKeys.playlist(LIST);

    for (const key of parts) expect(key.slice(0, playlist.length)).toEqual(playlist);
    expect(followedPlaylistIdsQueryOptions(api).queryKey.slice(0, 2)).toEqual(
      libraryKeys.followed()
    );
  });
});
