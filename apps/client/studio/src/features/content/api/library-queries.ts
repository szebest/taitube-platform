import { type QueryClient, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractResult, listCreatorVideos } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE } from '@vp/queries';
import type { LibraryQuery } from './library-search';

type LibraryPage = ContractResult<typeof listCreatorVideos>;

export interface LibraryView {
  items: LibraryPage['items'];
  page: number;
  hasNextPage: boolean;
}

export const libraryKeys = {
  all: ['studio', 'library'] as const,
  view: ({ sort, q, page }: LibraryQuery) => [...libraryKeys.all, sort, q ?? null, page] as const,
  cursor: ({ sort, q }: LibraryQuery, page: number) =>
    [...libraryKeys.all, 'cursor', sort, q ?? null, page] as const,
};

/**
 * The library is keyset-paginated, so page `n` of a sort and title filter is reached by following each page's cursor
 * from the nearest page whose cursor is cached; a page past the last answers the last one, with the
 * page it is.
 */
async function fetchLibraryView(
  api: ApiClient,
  client: QueryClient,
  query: LibraryQuery,
  signal: AbortSignal
): Promise<LibraryView> {
  const { sort, q, page } = query;
  let reached = page;
  let cursor = client.getQueryData<string>(libraryKeys.cursor(query, reached));
  while (reached > 1 && cursor === undefined) {
    reached--;
    cursor = client.getQueryData<string>(libraryKeys.cursor(query, reached));
  }

  let current = await api.creatorVideos.listCreatorVideos({
    query: { sort, q, limit: KEYSET_PAGE_SIZE, cursor },
    signal,
  });
  while (current.nextCursor !== null) {
    client.setQueryData(libraryKeys.cursor(query, reached + 1), current.nextCursor);
    if (reached >= page) {
      break;
    }
    reached++;
    current = await api.creatorVideos.listCreatorVideos({
      query: { sort, q, limit: KEYSET_PAGE_SIZE, cursor: current.nextCursor },
      signal,
    });
  }

  return { items: current.items, page: reached, hasNextPage: current.nextCursor !== null };
}

export function libraryQueryOptions(api: ApiClient, query: LibraryQuery) {
  return queryOptions({
    queryKey: libraryKeys.view(query),
    queryFn: ({ client, signal }) => fetchLibraryView(api, client, query, signal),
  });
}
