import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { Video } from '@vp/api-contracts';
import { videoKeys, videoQueryOptions, videoToolKeys } from '@vp/queries';
import { libraryKeys } from './library-queries';

const refreshVideo = (client: QueryClient, videoId: string) =>
  Promise.all([
    client.invalidateQueries({ queryKey: videoKeys.detail(videoId) }),
    client.invalidateQueries({ queryKey: libraryKeys.all }),
  ]);

const storeVideo = (client: QueryClient, api: ApiClient, videoId: string, video: Video) =>
  client.setQueryData(videoQueryOptions(api, videoId).queryKey, video);

export function replaceChaptersMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: { chapters: { startMs: number; title: string }[]; version: number }) =>
      api.videoTools.replaceVideoChapters({ params: { id: videoId }, body }),
    onSuccess: (updated, _body, _snapshot, { client }) => storeVideo(client, api, videoId, updated),
    onSettled: (_data, _error, _body, _snapshot, { client }) => refreshVideo(client, videoId),
  });
}

export function suggestChaptersMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: () => api.videoTools.getChapterSuggestions({ params: { id: videoId } }),
  });
}

export function restoreRevisionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (target: { revisionId: string; version: number }) =>
      api.videoTools.restoreVideoRevision({
        params: { id: videoId, revisionId: target.revisionId },
        body: { version: target.version },
      }),
    onSuccess: (updated, _target, _snapshot, { client }) =>
      storeVideo(client, api, videoId, updated),
    onSettled: (_data, _error, _target, _snapshot, { client }) =>
      Promise.all([
        refreshVideo(client, videoId),
        client.invalidateQueries({ queryKey: videoToolKeys.revisions(videoId) }),
      ]),
  });
}

export function addCorrectionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (body: { startMs: number; endMs: number; text: string }) =>
      api.videoTools.createVideoCorrection({ params: { id: videoId }, body }),
    onSettled: (_data, _error, _body, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoToolKeys.corrections(videoId) }),
  });
}

export function removeCorrectionMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (correctionId: string) =>
      api.videoTools.deleteVideoCorrection({ params: { id: videoId, correctionId } }),
    onSettled: (_data, _error, _id, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: videoToolKeys.corrections(videoId) }),
  });
}
