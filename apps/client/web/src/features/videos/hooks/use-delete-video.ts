import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, videoKeys, videoQueryOptions } from '@vp/queries';

import { feedKeys } from '#app/features/feed/api/feed-queries';

function deleteVideoMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: () => api.videos.deleteVideo({ params: { id: videoId } }),
    onSuccess: (_deleted, _variables, _snapshot, { client }) => {
      client.removeQueries({ queryKey: videoQueryOptions(api, videoId).queryKey });
    },
    onSettled: (_data, _error, _variables, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: videoKeys.mine() }),
        client.invalidateQueries({ queryKey: feedKeys.all }),
      ]),
  });
}

export function useDeleteVideo(videoId: string) {
  const api = useApi();
  return useMutation(deleteVideoMutationOptions(api, videoId));
}
