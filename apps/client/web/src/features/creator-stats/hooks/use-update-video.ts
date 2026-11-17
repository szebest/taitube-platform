import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractBody, updateCreatorVideo, Video } from '@vp/api-contracts';
import { useApi, videoKeys } from '@vp/queries';

type VideoChange = Pick<
  ContractBody<typeof updateCreatorVideo>,
  'title' | 'commentsEnabled' | 'selectedThumbnail'
>;

function updateVideoMutationOptions(api: ApiClient, video: Pick<Video, 'id' | 'version'>) {
  return mutationOptions({
    mutationFn: (change: VideoChange) =>
      api.creatorVideos.updateCreatorVideo({
        params: { id: video.id },
        body: { ...change, version: video.version },
      }),
    onSuccess: (updated, _change, _snapshot, { client }) => {
      client.setQueryData<Video>(
        videoKeys.detail(video.id),
        (cached) => cached && { ...cached, ...updated, channel: updated.channel ?? cached.channel }
      );
      return client.invalidateQueries({ queryKey: videoKeys.mine() });
    },
  });
}

/** The studio's `PATCH` against the version this page holds; a stale one comes back as `VERSION_CONFLICT`. */
export function useUpdateVideo(video: Pick<Video, 'id' | 'version'>) {
  const api = useApi();
  return useMutation(updateVideoMutationOptions(api, video));
}
