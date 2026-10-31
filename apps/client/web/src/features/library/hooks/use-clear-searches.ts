import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { searchHistoryQueryOptions } from '../api/library-queries';
import { emptyPages } from '../api/paged-list';
import { pagedMutationOptions } from './paged-mutation';
import { useListMutation } from './use-list-mutation';

function clearSearchesMutationOptions(api: ApiClient) {
  return pagedMutationOptions({
    key: searchHistoryQueryOptions(api).queryKey,
    request: () => api.searchHistory.clearSearchHistory(),
    edit: emptyPages,
  });
}

export function useClearSearches() {
  const api = useApi();
  return useListMutation(clearSearchesMutationOptions(api));
}
