import type { DataTag, QueryClient, QueryKey } from '@tanstack/react-query';

import { restoreQueryData } from '#app/integrations/query/restore-query-data';

export type CachedKey<TData> = DataTag<QueryKey, TData, Error>;

/** What a query showed before an optimistic edit, to put back when the request fails. */
export interface QuerySnapshot<TData> {
  previous: TData | undefined;
}

/** Writes `edit` over the cached data and returns what was there; nothing happens for a query never loaded. */
export async function editQuery<TData>(
  client: QueryClient,
  key: CachedKey<TData>,
  edit: (data: TData) => TData
): Promise<QuerySnapshot<TData>> {
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData(key);
  if (previous !== undefined) client.setQueryData(key, edit(previous));
  return { previous };
}

export function restoreQuery<TData>(
  client: QueryClient,
  key: CachedKey<TData>,
  snapshot: QuerySnapshot<TData> | undefined
): void {
  restoreQueryData(client, key, snapshot?.previous);
}
