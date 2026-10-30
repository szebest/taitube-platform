import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { VideoVisibility } from '@vp/domain';
import { videoKeys } from '@vp/queries';

import type { CreatorVideo } from '../components/library-video-row';
import { libraryKeys } from './library-queries';

export interface BatchOutcome {
  succeeded: string[];
  failed: string[];
}

export type BatchVideo = Pick<CreatorVideo, 'id' | 'version'>;

export interface VisibilityBatch {
  videos: readonly BatchVideo[];
  visibility: VideoVisibility;
}

async function eachVideo(
  videos: readonly BatchVideo[],
  run: (video: BatchVideo) => Promise<unknown>
): Promise<BatchOutcome> {
  const results = await Promise.allSettled(videos.map(run));
  const idsWhere = (status: PromiseSettledResult<unknown>['status']) =>
    videos.filter((_, index) => results[index]?.status === status).map(({ id }) => id);

  return { succeeded: idsWhere('fulfilled'), failed: idsWhere('rejected') };
}

const refetchVideos = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: libraryKeys.all }),
    client.invalidateQueries({ queryKey: videoKeys.all }),
  ]);

export function deleteVideosMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: (videos: readonly BatchVideo[]) =>
      eachVideo(videos, ({ id }) => api.creatorVideos.deleteCreatorVideo({ params: { id } })),
    onSettled: (_outcome, _error, _videos, _snapshot, { client }) => refetchVideos(client),
  });
}

export function setVisibilityMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: ({ videos, visibility }: VisibilityBatch) =>
      eachVideo(videos, ({ id, version }) =>
        api.creatorVideos.updateCreatorVideo({ params: { id }, body: { visibility, version } })
      ),
    onSettled: (_outcome, _error, _batch, _snapshot, { client }) => refetchVideos(client),
  });
}
