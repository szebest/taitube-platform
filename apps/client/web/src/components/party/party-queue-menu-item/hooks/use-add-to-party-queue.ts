import { useToast } from '@kit/ui';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, useFailureToast } from '@vp/queries';
import { useT } from '#app/lib/messages';

interface Addition {
  roomId: string;
  videoId: string;
}

function addToPartyQueueMutationOptions(
  api: ApiClient,
  done: () => void,
  failed: (error: Error) => void
) {
  return mutationOptions({
    mutationFn: ({ roomId, videoId }: Addition) =>
      api.watchPartyQueue.addToWatchPartyQueue({ params: { id: roomId }, body: { videoId } }),
    onSuccess: done,
    onError: failed,
  });
}

/** Appends a video to a party's queue and says so. */
export function useAddToPartyQueue() {
  const api = useApi();
  const { tOr } = useT();
  const showToast = useToast();
  const showFailure = useFailureToast();

  return useMutation(
    addToPartyQueueMutationOptions(
      api,
      () => showToast({ tone: 'success', title: tOr('party.queueAdded', {}, '') }),
      (error) => showFailure(tOr('party.queueAddToPartyFailed', {}, ''), error)
    )
  );
}
