import type { DataTag, InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

import { restoreQueryData } from '#app/integrations/query/restore-query-data';

export interface Page<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

export type PagedKey<TPage> = DataTag<QueryKey, InfiniteData<TPage>, Error>;

/** What a list showed before an optimistic edit, to put back when the request fails. */
export interface PagedSnapshot<TPage> {
  previous: InfiniteData<TPage> | undefined;
}

/** Writes `edit` over the cached pages and returns what was there; nothing happens for a list never loaded. */
export async function editPages<TPage>(
  client: QueryClient,
  key: PagedKey<TPage>,
  edit: (data: InfiniteData<TPage>) => InfiniteData<TPage>
): Promise<PagedSnapshot<TPage>> {
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData(key);
  if (previous) client.setQueryData(key, edit(previous));
  return { previous };
}

export function restorePages<TPage>(
  client: QueryClient,
  key: PagedKey<TPage>,
  snapshot: PagedSnapshot<TPage> | undefined
): void {
  restoreQueryData(client, key, snapshot?.previous);
}

export function dropItems<TPage extends Page<unknown>>(
  data: InfiniteData<TPage>,
  drop: (item: TPage['items'][number]) => boolean
): InfiniteData<TPage> {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => !drop(item)) })),
  };
}

export function emptyPages<TPage extends Page<unknown>>(
  data: InfiniteData<TPage>
): InfiniteData<TPage> {
  const [first] = data.pages;
  if (!first) return data;
  return { pages: [{ ...first, items: [], nextCursor: null }], pageParams: [undefined] };
}
