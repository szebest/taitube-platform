import type { FakeStore } from './fake-api-store';
import { type Route, problem } from './fake-api-types';

export function libraryRoutes(store: FakeStore): Route[] {
  const { playlists, history, searches, id } = store;
  return [
    [
      'GET',
      '/v1/me/playlists',
      ({ actor }) => ({
        body: {
          items: [
            { id: `later-${actor?.id}`, title: 'Watch Later', isSystem: true },
            ...playlists.filter((p) => p.ownerId === actor?.id),
          ],
        },
      }),
    ],
    [
      'POST',
      '/v1/playlists',
      ({ actor, json }) => {
        const playlist = {
          id: id('playlist'),
          ownerId: actor?.id ?? '',
          title: json.title ?? '',
          isSystem: false,
          items: [],
        };
        playlists.push(playlist);
        return { status: 201, body: playlist };
      },
    ],
    [
      'GET',
      '/v1/playlists/:id',
      ({ params }) => {
        const playlist = playlists.find((p) => p.id === params.id);
        return playlist
          ? { body: { id: playlist.id, items: playlist.items.map((videoId) => ({ videoId })) } }
          : problem(404, 'PLAYLIST_NOT_FOUND');
      },
    ],
    [
      'POST',
      '/v1/playlists/:id/items',
      ({ params, json }) => {
        playlists.find((p) => p.id === params.id)?.items.push(json.videoId ?? '');
        return { status: 201, body: {} };
      },
    ],
    [
      'GET',
      '/v1/me/history/:videoId',
      ({ actor, params }) => ({
        body: {
          playhead: history.has(`${actor?.id}:${params.videoId}`) ? { progressSeconds: 1 } : null,
        },
      }),
    ],
    [
      'POST',
      '/v1/me/history',
      ({ actor, json }) => {
        history.add(`${actor?.id}:${json.videoId}`);
        return { body: {} };
      },
    ],
    [
      'GET',
      '/v1/search',
      ({ actor, query }) => {
        searches.set(actor?.id ?? '', [
          ...(searches.get(actor?.id ?? '') ?? []),
          query.get('q') ?? '',
        ]);
        return { body: { items: [] } };
      },
    ],
    [
      'GET',
      '/v1/me/searches',
      ({ actor }) => ({
        body: {
          items: (searches.get(actor?.id ?? '') ?? []).map((query) => ({ id: query, query })),
          nextCursor: null,
        },
      }),
    ],
  ];
}
