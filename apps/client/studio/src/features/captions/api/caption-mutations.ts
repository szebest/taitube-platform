import { type QueryClient, mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { CaptionListView, ContractBody, editCaptionCues } from '@vp/api-contracts';
import { videoKeys } from '@vp/queries';

type CueEdit = ContractBody<typeof editCaptionCues>;

const refresh = (client: QueryClient, videoId: string) =>
  client.invalidateQueries({ queryKey: videoKeys.captions(videoId) });

/** The tri-state switch: the answer is the whole list, so it goes straight into the cache. */
export function autoCaptionsMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (autoCaptions: boolean | null) =>
      api.captions.updateCaptionSettings({ params: { id: videoId }, body: { autoCaptions } }),
    onSuccess: (list, _autoCaptions, _snapshot, { client }) => {
      client.setQueryData<CaptionListView>(videoKeys.captions(videoId), list);
    },
  });
}

export function uploadTrackMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: ({ language, vtt }: { language: string; vtt: string }) =>
      api.captions.uploadCaptionTrack({ params: { id: videoId, lang: language }, body: vtt }),
    onSuccess: (_track, _upload, _snapshot, { client }) => refresh(client, videoId),
  });
}

export function editCuesMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: ({ language, ...edit }: CueEdit & { language: string }) =>
      api.captions.editCaptionCues({ params: { id: videoId, lang: language }, body: edit }),
    onSuccess: (_track, _edit, _snapshot, { client }) => refresh(client, videoId),
  });
}

export function deleteTrackMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (language: string) =>
      api.captions.deleteCaptionTrack({ params: { id: videoId, lang: language } }),
    onSuccess: (_nothing, _language, _snapshot, { client }) => refresh(client, videoId),
  });
}

export function generateMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (request: { language: string | null; overwrite: boolean }) =>
      api.captions.generateCaptions({ params: { id: videoId }, body: request }),
    onSuccess: (_track, _request, _snapshot, { client }) => refresh(client, videoId),
  });
}
