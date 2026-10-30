import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { restoreQueryData } from '#app/integrations/query/restore-query-data';
import { recentSearchesQueryOptions, searchHistoryKeys } from '../api/search-history-queries';

function removeRecentSearchMutationOptions(api: ApiClient) {
  const recentKey = recentSearchesQueryOptions(api).queryKey;

  return mutationOptions({
    mutationFn: (id: string) => api.searchHistory.removeSearchHistoryEntry({ params: { id } }),
    onMutate: async (id, { client }) => {
      await client.cancelQueries({ queryKey: recentKey });
      const previous = client.getQueryData(recentKey);
      if (previous) {
        client.setQueryData(recentKey, {
          ...previous,
          items: previous.items.filter((entry) => entry.id !== id),
        });
      }
      return { previous };
    },
    onError: (_error, _id, snapshot, { client }) =>
      restoreQueryData(client, recentKey, snapshot?.previous),
    onSettled: (_data, _error, _id, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: searchHistoryKeys.all }),
  });
}

export function useRemoveRecentSearch() {
  return useMutation(removeRecentSearchMutationOptions(useApi()));
}
