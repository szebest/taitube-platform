import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, updateCreatorVideo } from '@vp/api-contracts';
import { useApi, videoKeys, videoQueryOptions } from '@vp/queries';

import { libraryKeys } from '#app/features/content/api/library-queries';

export type VideoEdit = ContractBody<typeof updateCreatorVideo>;

function updateVideoMutationOptions(api: ApiClient, videoId: string) {
  const detailKey = videoQueryOptions(api, videoId).queryKey;

  return mutationOptions({
    mutationFn: (edit: VideoEdit) =>
      api.creatorVideos.updateCreatorVideo({ params: { id: videoId }, body: edit }),
    onSuccess: (updated, _edit, _snapshot, { client }) => {
      client.setQueryData(detailKey, updated);
    },
    onSettled: (_data, _error, _edit, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: detailKey }),
        client.invalidateQueries({ queryKey: videoKeys.mine() }),
        client.invalidateQueries({ queryKey: libraryKeys.all }),
      ]),
  });
}

export function useUpdateVideo(videoId: string) {
  const api = useApi();
  return useMutation(updateVideoMutationOptions(api, videoId));
}
