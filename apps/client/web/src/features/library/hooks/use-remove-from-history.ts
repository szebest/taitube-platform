import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { libraryKeys, watchHistoryQueryOptions } from '../api/library-queries';
import { dropItems } from '../api/paged-list';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

function removeFromHistoryMutationOptions(api: ApiClient, videoId: string) {
  return queryMutationOptions({
    key: watchHistoryQueryOptions(api).queryKey,
    request: () => api.watchHistory.removeWatchHistoryEntry({ params: { videoId } }),
    edit: (data) => dropItems(data, (item) => item.videoId === videoId),
    invalidate: [libraryKeys.history()],
  });
}

export function useRemoveFromHistory(videoId: string) {
  const api = useApi();
  return useListMutation(removeFromHistoryMutationOptions(api, videoId));
}
