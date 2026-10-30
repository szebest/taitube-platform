import { infiniteQueryOptions, mutationOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ChannelFeaturedView, VideoSummary } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

const featuredKeys = {
  all: ['studio', 'channel-featured'] as const,
  shelf: (channelId: string) => [...featuredKeys.all, 'shelf', channelId] as const,
  pickable: () => [...featuredKeys.all, 'pickable'] as const,
};

/** The shelf as a visitor reads it now: the pins, or the most-watched fallback. */
export function featuredQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: featuredKeys.shelf(channelId),
    queryFn: () => api.channelFeatured.getChannelFeatured({ params: { idOrHandle: channelId } }),
  });
}

/** The creator's videos a pin accepts: ready and public, newest first. */
export function pickableVideosQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: featuredKeys.pickable(),
    queryFn: ({ pageParam }) =>
      api.creatorVideos.listCreatorVideos({
        query: {
          status: 'READY',
          visibility: 'public',
          sort: 'newest',
          limit: KEYSET_PAGE_SIZE,
          cursor: pageParam,
        },
      }),
    ...keysetPaging,
  });
}

interface Snapshot {
  previous: ChannelFeaturedView | undefined;
}

/**
 * Replaces the pins. The shelf in the cache takes the new order at once and goes back to what it was
 * when the API refuses; saves run one after another so a refused one cannot undo a later one.
 */
export function saveFeaturedMutationOptions(api: ApiClient, channelId: string) {
  const queryKey = featuredKeys.shelf(channelId);

  return mutationOptions({
    scope: { id: queryKey.join('/') },
    mutationFn: (pins: readonly VideoSummary[]) =>
      api.channelFeatured.setChannelFeatured({ body: { videoIds: pins.map(({ id }) => id) } }),
    onMutate: async (pins, { client }): Promise<Snapshot> => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<ChannelFeaturedView>(queryKey);
      client.setQueryData<ChannelFeaturedView>(queryKey, {
        source: pins.length === 0 ? 'popular' : 'pinned',
        items: [...pins],
      });
      return { previous };
    },
    onError: (_error, _pins, snapshot, { client }) =>
      client.setQueryData(queryKey, snapshot?.previous),
    onSuccess: (view, _pins, _snapshot, { client }) => client.setQueryData(queryKey, view),
  });
}
