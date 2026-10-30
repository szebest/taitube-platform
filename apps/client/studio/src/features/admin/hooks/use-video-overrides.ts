import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { type AdminVideo, adminVideoKeys } from '#app/features/admin/api/admin-videos';

const refetchVideos = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: adminVideoKeys.all });

/** Makes a video private, against the version the list showed. */
export function useForcePrivate() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, version }: AdminVideo) =>
        api.creatorVideos.updateCreatorVideo({
          params: { id },
          body: { visibility: 'private', version },
        }),
      onSettled: (_data, _error, _video, _snapshot, { client }) => refetchVideos(client),
    })
  );
}

/** Takes a video down: rejected and private, with the reason kept in its events. */
export function useRejectVideo() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ video, reason }: { video: AdminVideo; reason: string }) =>
        api.adminVideos.takeDownVideo({ params: { id: video.id }, body: { reason } }),
      onSettled: (_data, _error, _variables, _snapshot, { client }) => refetchVideos(client),
    })
  );
}

export function useDeleteVideo() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id }: AdminVideo) => api.creatorVideos.deleteCreatorVideo({ params: { id } }),
      onSettled: (_data, _error, _video, _snapshot, { client }) => refetchVideos(client),
    })
  );
}
