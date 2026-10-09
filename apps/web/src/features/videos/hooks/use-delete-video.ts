import { mutationOptions, useMutation } from '@tanstack/react-query';

import { feedKeys } from '#app/features/feed/api/feed-queries';
import { apiClient } from '#app/integrations/api/api-client';

import { videoKeys, videoQueryOptions } from '../api/video-queries';

function deleteVideoMutationOptions(videoId: string) {
  return mutationOptions({
    mutationFn: () => apiClient.videos.deleteVideo({ params: { id: videoId } }),
    onSuccess: (_deleted, _variables, _snapshot, { client }) => {
      client.removeQueries({ queryKey: videoQueryOptions(videoId).queryKey });
    },
    onSettled: (_data, _error, _variables, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: videoKeys.mine() }),
        client.invalidateQueries({ queryKey: feedKeys.all }),
      ]),
  });
}

export function useDeleteVideo(videoId: string) {
  return useMutation(deleteVideoMutationOptions(videoId));
}
