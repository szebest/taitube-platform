import type { QueryClient } from '@tanstack/react-query';
import {
  getPlaylist,
  listChannelVideos,
  listLikedVideos,
  listMyComments,
  listMyPlaylists,
  listSearchHistory,
  listWatchHistory,
} from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import {
  WATCH_LATER_ID,
  watchLaterPlaylist,
} from '#app/features/library/__tests__/library-fixtures';
import {
  libraryKeys,
  likedVideosQueryOptions,
  myCommentsQueryOptions,
  myPlaylistsQueryOptions,
  playlistQueryOptions,
  saveTargetsQueryOptions,
  searchHistoryQueryOptions,
  uploadsShelfQueryOptions,
  watchHistoryQueryOptions,
} from '../library-queries';

const KEYSET = [
  {
    name: 'watch history',
    contract: listWatchHistory,
    fetch: (client: QueryClient) =>
      client.fetchInfiniteQuery({ ...watchHistoryQueryOptions(api), pages: 2 }),
  },
  {
    name: 'search history',
    contract: listSearchHistory,
    fetch: (client: QueryClient) =>
      client.fetchInfiniteQuery({ ...searchHistoryQueryOptions(api), pages: 2 }),
  },
  {
    name: 'liked videos',
    contract: listLikedVideos,
    fetch: (client: QueryClient) =>
      client.fetchInfiniteQuery({ ...likedVideosQueryOptions(api), pages: 2 }),
  },
  {
    name: 'my comments',
    contract: listMyComments,
    fetch: (client: QueryClient) =>
      client.fetchInfiniteQuery({ ...myCommentsQueryOptions(api), pages: 2 }),
  },
] as const;

const KEYSET_KEYS = [
  watchHistoryQueryOptions(api).queryKey,
  searchHistoryQueryOptions(api).queryKey,
  likedVideosQueryOptions(api).queryKey,
  myCommentsQueryOptions(api).queryKey,
];

describe('apps/client/web: library queries', () => {
  it.each(KEYSET)('reads $name a keyset page at a time', async ({ contract, fetch }) => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(contract, ({ request }) => {
        const { searchParams } = new URL(request.url);
        asked.push(searchParams.toString());
        return HttpResponse.json({
          items: [],
          nextCursor: searchParams.has('cursor') ? null : 'next',
        } as never);
      })
    );
    const client = createQueryClient();

    await fetch(client);

    expect(asked).toEqual(['limit=30', 'limit=30&cursor=next']);
  });

  it.each([
    { name: 'the keyset lists', keys: KEYSET_KEYS },
    {
      name: 'the shelves',
      keys: [
        myPlaylistsQueryOptions(api).queryKey,
        playlistQueryOptions(api, VIDEO_ID).queryKey,
        saveTargetsQueryOptions(api, VIDEO_ID).queryKey,
        uploadsShelfQueryOptions(api, VIDEO_ID).queryKey,
      ],
    },
  ])('keys $name under the library key, so one invalidation reaches them all', ({ keys }) => {
    for (const key of keys) expect(key.slice(0, libraryKeys.all.length)).toEqual(libraryKeys.all);
  });

  it('reads the playlists, Watch Later and the own channel for the shelves', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(listMyPlaylists, () => {
        asked.push('playlists');
        return HttpResponse.json({ items: [] });
      }),
      mockEndpoint(getPlaylist, ({ params }) => {
        asked.push(`playlist ${params.id}`);
        return HttpResponse.json(watchLaterPlaylist(String(params.id), []));
      }),
      mockEndpoint(listChannelVideos, ({ params, request }) => {
        asked.push(`channel ${params.idOrHandle} ${new URL(request.url).searchParams}`);
        return HttpResponse.json({ items: [], nextCursor: null, total: 0 });
      })
    );
    const client = createQueryClient();

    await client.fetchQuery(myPlaylistsQueryOptions(api));
    await client.fetchQuery(playlistQueryOptions(api, WATCH_LATER_ID));
    await client.fetchQuery(uploadsShelfQueryOptions(api, 'ch'));

    expect(asked).toEqual(['playlists', `playlist ${WATCH_LATER_ID}`, 'channel ch limit=12']);
  });

  it('asks which playlists hold the video for the save dialog', async () => {
    const asked: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listMyPlaylists, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('videoId'));
        return HttpResponse.json({ items: [] });
      })
    );

    await createQueryClient().fetchQuery(saveTargetsQueryOptions(api, VIDEO_ID));

    expect(asked).toEqual([VIDEO_ID]);
  });
});
