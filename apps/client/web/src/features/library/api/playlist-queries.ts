import { KEYSET_PAGE_SIZE, keysetPaging } from '@kit/query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PlaylistItemSort, PlaylistStatsRange } from '@vp/domain';
import { libraryKeys } from '#app/lib/query-keys/library-keys';

export function playlistCollaboratorsQueryOptions(api: ApiClient, playlistId: string) {
  return queryOptions({
    queryKey: libraryKeys.playlistPart(playlistId, 'collaborators'),
    queryFn: () =>
      api.playlistCollaboration.listPlaylistCollaborators({ params: { id: playlistId } }),
    retry: false,
  });
}

export function playlistInvitesQueryOptions(api: ApiClient, playlistId: string) {
  return queryOptions({
    queryKey: libraryKeys.playlistPart(playlistId, 'invites'),
    queryFn: () => api.playlistCollaboration.listPlaylistInvites({ params: { id: playlistId } }),
  });
}

export function playlistActivityQueryOptions(api: ApiClient, playlistId: string) {
  return infiniteQueryOptions({
    queryKey: libraryKeys.playlistPart(playlistId, 'activity'),
    queryFn: ({ pageParam }) =>
      api.playlistActivity.listPlaylistActivity({
        params: { id: playlistId },
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

export function playlistShareLinksQueryOptions(api: ApiClient, playlistId: string) {
  return queryOptions({
    queryKey: libraryKeys.playlistPart(playlistId, 'share-links'),
    queryFn: () => api.playlistSharing.listPlaylistShareLinks({ params: { id: playlistId } }),
  });
}

export function playlistStatsQueryOptions(
  api: ApiClient,
  playlistId: string,
  range: PlaylistStatsRange
) {
  return queryOptions({
    queryKey: [...libraryKeys.playlistPart(playlistId, 'stats'), range],
    queryFn: () =>
      api.playlistSharing.getPlaylistStats({ params: { id: playlistId }, query: { range } }),
  });
}

/** The id of every playlist the viewer follows, every page read, for a Follow button's state. */
export function followedPlaylistIdsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: [...libraryKeys.followed(), 'ids'],
    queryFn: async () => {
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.playlistLibrary.listFollowedPlaylists({
          query: { limit: KEYSET_PAGE_SIZE, cursor },
        });
        ids.push(...page.items.map(({ playlistId }) => playlistId));
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
      return ids;
    },
  });
}

/** A playlist's videos in a viewing order other than its own, sections left out; `shareToken` stays out of the key. */
export function sortedPlaylistItemsQueryOptions(
  api: ApiClient,
  playlistId: string,
  sort: Exclude<PlaylistItemSort, 'manual'>,
  shareToken?: string
) {
  return infiniteQueryOptions({
    queryKey: [...libraryKeys.playlistPart(playlistId, 'items'), sort],
    queryFn: ({ pageParam }) =>
      api.playlistItems.listPlaylistItems({
        params: { id: playlistId },
        query: {
          sort,
          limit: KEYSET_PAGE_SIZE,
          cursor: pageParam,
          ...(shareToken === undefined ? {} : { s: shareToken }),
        },
      }),
    ...keysetPaging,
  });
}

export function followedPlaylistsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: libraryKeys.followed(),
    queryFn: ({ pageParam }) =>
      api.playlistLibrary.listFollowedPlaylists({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
