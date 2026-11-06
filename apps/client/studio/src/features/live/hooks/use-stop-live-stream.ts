import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { liveKeys } from '../api/live-queries';

function stopLiveStreamMutationOptions(api: ApiClient, id: string) {
  return mutationOptions({
    mutationFn: () => api.creatorLive.stopMyLiveStream({ params: { id } }),
    onSuccess: (stream, _variables, _snapshot, { client }) => {
      client.setQueryData(liveKeys.mine(), stream);
    },
  });
}

/** Stops the broadcast: the 202 body, the ended stream, replaces the cached one. */
export function useStopLiveStream(id: string) {
  return useMutation(stopLiveStreamMutationOptions(useApi(), id));
}
