import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { UpdateVideoMetadata } from '@vp/api-contracts';
import { useApi, videoKeys, videoQueryOptions } from '@vp/queries';

function updateVideoMutationOptions(api: ApiClient, videoId: string) {
  const detailKey = videoQueryOptions(api, videoId).queryKey;

  return mutationOptions({
    mutationFn: (changes: UpdateVideoMetadata) =>
      api.videos.updateVideo({ params: { id: videoId }, body: changes }),
    onSuccess: (updated, _changes, _snapshot, { client }) => {
      client.setQueryData(detailKey, updated);
    },
    onSettled: (_data, _error, _changes, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: detailKey }),
        client.invalidateQueries({ queryKey: videoKeys.mine() }),
      ]),
  });
}

export function useUpdateVideo(videoId: string) {
  const api = useApi();
  return useMutation(updateVideoMutationOptions(api, videoId));
}
