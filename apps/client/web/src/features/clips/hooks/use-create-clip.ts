import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { clipKeys, useApi } from '@vp/queries';

export interface NewClip {
  startMs: number;
  endMs: number;
  title: string;
}

function createClipMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (clip: NewClip) => api.clips.createClip({ params: { id: videoId }, body: clip }),
    onSuccess: (_clip, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: clipKeys.mine() }),
  });
}

export function useCreateClip(videoId: string) {
  const api = useApi();
  return useMutation(createClipMutationOptions(api, videoId));
}
