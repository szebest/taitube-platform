import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { searchHistoryQueryOptions } from '../api/library-queries';
import { dropItems } from '../api/paged-list';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

function removeSearchMutationOptions(api: ApiClient, searchId: string) {
  return queryMutationOptions({
    key: searchHistoryQueryOptions(api).queryKey,
    request: () => api.searchHistory.removeSearchHistoryEntry({ params: { id: searchId } }),
    edit: (data) => dropItems(data, (item) => item.id === searchId),
  });
}

export function useRemoveSearch(searchId: string) {
  const api = useApi();
  return useListMutation(removeSearchMutationOptions(api, searchId));
}
