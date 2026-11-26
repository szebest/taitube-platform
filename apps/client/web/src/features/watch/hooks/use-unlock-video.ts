import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

function unlockVideoMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationFn: (password: string) =>
      api.videoAccess.unlockVideo({ params: { id: videoId }, body: { password } }),
  });
}

/** Sends a password for the video; the unlock cookie comes back on this origin through the `/api` proxy. */
export function useUnlockVideo(videoId: string) {
  const api = useApi();
  return useMutation(unlockVideoMutationOptions(api, videoId));
}
