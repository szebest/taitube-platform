import { fromPromise, isErr } from '@kit/result';
import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import { ApiError, type ApiClient } from '@vp/api-client';
import type { BulkEditPatch } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { videoKeys } from '@vp/queries';
import type { CreatorVideo } from '../components/library-video-row/library-video-row';
import { libraryKeys } from './library-queries';

interface BatchFailure {
  id: string;
  code: string;
}

export interface BatchOutcome {
  succeeded: string[];
  failed: BatchFailure[];
}

export type BatchVideo = Pick<CreatorVideo, 'id' | 'title'>;

export interface VideoEdit {
  videos: readonly BatchVideo[];
  patch: BulkEditPatch;
}

const codeOf = (cause: unknown): string =>
  cause instanceof ApiError ? cause.code : ErrorCodes.INTERNAL;

async function eachVideo(
  videos: readonly BatchVideo[],
  run: (video: BatchVideo) => Promise<unknown>
): Promise<BatchOutcome> {
  const results = await Promise.all(
    videos.map(async (video) => ({
      id: video.id,
      result: await fromPromise(() => run(video), codeOf),
    }))
  );
  const failed = results.flatMap(({ id, result }) =>
    isErr(result) ? [{ id, code: result.error }] : []
  );
  const refused = new Set(failed.map(({ id }) => id));
  return { succeeded: videos.map(({ id }) => id).filter((id) => !refused.has(id)), failed };
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

/** One bulk edit: each id is its own edit on the server, so a refusal fails that video only. */
export function editVideosMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: async ({ videos, patch }: VideoEdit): Promise<BatchOutcome> => {
      const { items } = await api.videoTools.bulkEditCreatorVideos({
        body: { ids: videos.map(({ id }) => id), patch },
      });
      return {
        succeeded: items.filter(({ ok }) => ok).map(({ id }) => id),
        failed: items
          .filter(({ ok }) => !ok)
          .map(({ id, code }) => ({ id, code: code ?? ErrorCodes.INTERNAL })),
      };
    },
    onSettled: (_outcome, _error, _edit, _snapshot, { client }) => refetchVideos(client),
  });
}
