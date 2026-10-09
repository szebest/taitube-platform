import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';

const reactionKeys = {
  all: ['reactions'] as const,
  mine: (videoId: string) => [...reactionKeys.all, 'mine', videoId] as const,
};

export function myReactionQueryOptions(videoId: string) {
  return queryOptions({
    queryKey: reactionKeys.mine(videoId),
    queryFn: () => apiClient.reactions.getMyReaction({ params: { id: videoId } }),
  });
}
