import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const reactionKeys = {
  all: ['reactions'] as const,
  mine: (videoId: string) => [...reactionKeys.all, 'mine', videoId] as const,
};

export function myReactionQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: reactionKeys.mine(videoId),
    queryFn: () => api.reactions.getMyReaction({ params: { id: videoId } }),
  });
}
