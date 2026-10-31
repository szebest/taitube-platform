import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { searchHistoryQueryOptions } from '../api/library-queries';
import { dropItems } from '../api/paged-list';
import { pagedMutationOptions } from './paged-mutation';
import { useListMutation } from './use-list-mutation';

function removeSearchMutationOptions(api: ApiClient, searchId: string) {
  return pagedMutationOptions({
    key: searchHistoryQueryOptions(api).queryKey,
    request: () => api.searchHistory.removeSearchHistoryEntry({ params: { id: searchId } }),
    edit: (data) => dropItems(data, (item) => item.id === searchId),
  });
}

export function useRemoveSearch(searchId: string) {
  const api = useApi();
  return useListMutation(removeSearchMutationOptions(api, searchId));
}
