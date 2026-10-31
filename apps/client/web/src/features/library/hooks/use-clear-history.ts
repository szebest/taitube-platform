import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { libraryKeys, watchHistoryQueryOptions } from '../api/library-queries';
import { emptyPages } from '../api/paged-list';
import { pagedMutationOptions } from './paged-mutation';
import { useListMutation } from './use-list-mutation';

function clearHistoryMutationOptions(api: ApiClient) {
  return pagedMutationOptions({
    key: watchHistoryQueryOptions(api).queryKey,
    request: () => api.watchHistory.clearWatchHistory(),
    edit: emptyPages,
    invalidate: [libraryKeys.history()],
  });
}

export function useClearHistory() {
  const api = useApi();
  return useListMutation(clearHistoryMutationOptions(api));
}
