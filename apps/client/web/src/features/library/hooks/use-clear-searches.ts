import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { searchHistoryQueryOptions } from '../api/library-queries';
import { emptyPages } from '../api/paged-list';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

function clearSearchesMutationOptions(api: ApiClient) {
  return queryMutationOptions({
    key: searchHistoryQueryOptions(api).queryKey,
    request: () => api.searchHistory.clearSearchHistory(),
    edit: emptyPages,
  });
}

export function useClearSearches() {
  const api = useApi();
  return useListMutation(clearSearchesMutationOptions(api));
}
