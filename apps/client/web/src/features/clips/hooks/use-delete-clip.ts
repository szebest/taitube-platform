import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { clipKeys, useApi } from '@vp/queries';

function deleteClipMutationOptions(api: ApiClient, clipId: string) {
  return mutationOptions({
    mutationFn: () => api.clips.deleteClip({ params: { id: clipId } }),
    onSuccess: (_result, _variables, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: clipKeys.mine() }),
        client.invalidateQueries({ queryKey: clipKeys.detail(clipId), refetchType: 'none' }),
      ]),
  });
}

export function useDeleteClip(clipId: string) {
  const api = useApi();
  return useMutation(deleteClipMutationOptions(api, clipId));
}
