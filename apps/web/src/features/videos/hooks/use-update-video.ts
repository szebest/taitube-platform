import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { UpdateVideoMetadata } from '@vp/api-contracts';

import { feedKeys } from '#app/features/feed/api/feed-queries';
import { apiClient } from '#app/integrations/api/api-client';

import { videoKeys, videoQueryOptions } from '../api/video-queries';

function updateVideoMutationOptions(videoId: string) {
  const detailKey = videoQueryOptions(videoId).queryKey;

  return mutationOptions({
    mutationFn: (changes: UpdateVideoMetadata) =>
      apiClient.videos.updateVideo({ params: { id: videoId }, body: changes }),
    onSuccess: (updated, _changes, _snapshot, { client }) => {
      client.setQueryData(detailKey, updated);
    },
    onSettled: (_data, _error, _changes, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: detailKey }),
        client.invalidateQueries({ queryKey: videoKeys.mine() }),
        client.invalidateQueries({ queryKey: feedKeys.all }),
      ]),
  });
}

export function useUpdateVideo(videoId: string) {
  return useMutation(updateVideoMutationOptions(videoId));
}
