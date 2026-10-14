import type { DataTag, QueryClient, QueryKey } from '@tanstack/react-query';

export function restoreQueryData<T>(
  client: QueryClient,
  queryKey: DataTag<QueryKey, T, Error>,
  snapshot: T | undefined
): void {
  if (snapshot === undefined) {
    client.removeQueries({ queryKey, exact: true });
    return;
  }
  client.setQueryData(queryKey, snapshot);
}
