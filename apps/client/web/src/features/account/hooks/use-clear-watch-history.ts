import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

function clearWatchHistoryMutationOptions(api: ApiClient) {
  return mutationOptions({ mutationFn: () => api.watchHistory.clearWatchHistory() });
}

export function useClearWatchHistory() {
  const api = useApi();
  return useMutation(clearWatchHistoryMutationOptions(api));
}
