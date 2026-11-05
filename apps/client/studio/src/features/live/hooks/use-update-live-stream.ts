import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { UpdateLiveStreamBody } from '@vp/api-contracts';
import { useApi } from '@vp/queries';

import { liveKeys } from '../api/live-queries';

export function updateLiveStreamMutationOptions(api: ApiClient, id: string) {
  return mutationOptions({
    mutationFn: (changes: UpdateLiveStreamBody) =>
      api.creatorLive.updateMyLiveStream({ params: { id }, body: changes }),
    onSuccess: (stream, _changes, _snapshot, { client }) => {
      client.setQueryData(liveKeys.mine(), stream);
    },
  });
}

/** One save of the stream's details or chat mode; the stream it returns replaces the cached one. */
export function useUpdateLiveStream(id: string) {
  return useMutation(updateLiveStreamMutationOptions(useApi(), id));
}
