import { assertNever } from '@kit/result';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { CreateWatchPartyBody } from '@vp/api-contracts';
import { useApi, watchPartyKeys } from '@vp/queries';
import type { WatchTogetherSource } from '../types';

function toRoomSource(source: WatchTogetherSource): CreateWatchPartyBody['source'] {
  switch (source.kind) {
    case 'empty':
      return undefined;
    case 'video':
      return { videoId: source.videoId, startMs: source.startMs };
    case 'playlist':
      return { playlistId: source.playlistId };
    case 'queue':
      return { videoIds: source.videoIds, startIndex: source.startIndex };
    default:
      return assertNever(source, 'WatchTogetherSource');
  }
}

function quickWatchPartyQueryOptions(api: ApiClient, source: WatchTogetherSource) {
  return queryOptions({
    queryKey: [...watchPartyKeys.all, 'quick', source],
    queryFn: () =>
      api.watchParties.createWatchParty({
        body: {
          visibility: 'unlisted',
          preset: 'friends',
          hostAs: 'user',
          reuse: true,
          source: toRoomSource(source),
        },
      }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * The quick party for a source: unlisted, and the caller's unstarted room for the same source reused,
 * so asking again answers the same room.
 */
export function useQuickWatchParty(source: WatchTogetherSource) {
  const api = useApi();

  return useQuery(quickWatchPartyQueryOptions(api, source));
}
