import { type QueryClient, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractResult, listCreatorVideos } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE } from '@vp/queries';

import type { LibrarySort } from './library-search';

type LibraryPage = ContractResult<typeof listCreatorVideos>;

export interface LibraryView {
  items: LibraryPage['items'];
  page: number;
  hasNextPage: boolean;
}

const libraryKeys = {
  all: ['studio', 'library'] as const,
  view: (sort: LibrarySort, page: number) => [...libraryKeys.all, sort, page] as const,
  cursor: (sort: LibrarySort, page: number) => [...libraryKeys.all, 'cursor', sort, page] as const,
};

/**
 * The library is keyset-paginated, so page `n` of a sort is reached by following each page's cursor
 * from the nearest page whose cursor is cached; a page past the last answers the last one, with the
 * page it is.
 */
async function fetchLibraryView(
  api: ApiClient,
  client: QueryClient,
  sort: LibrarySort,
  page: number,
  signal: AbortSignal
): Promise<LibraryView> {
  let reached = page;
  let cursor = client.getQueryData<string>(libraryKeys.cursor(sort, reached));
  while (reached > 1 && cursor === undefined) {
    reached--;
    cursor = client.getQueryData<string>(libraryKeys.cursor(sort, reached));
  }

  let current = await api.creatorVideos.listCreatorVideos({
    query: { sort, limit: KEYSET_PAGE_SIZE, cursor },
    signal,
  });
  while (current.nextCursor !== null) {
    client.setQueryData(libraryKeys.cursor(sort, reached + 1), current.nextCursor);
    if (reached >= page) {
      break;
    }
    reached++;
    current = await api.creatorVideos.listCreatorVideos({
      query: { sort, limit: KEYSET_PAGE_SIZE, cursor: current.nextCursor },
      signal,
    });
  }

  return { items: current.items, page: reached, hasNextPage: current.nextCursor !== null };
}

export function libraryQueryOptions(api: ApiClient, sort: LibrarySort, page: number) {
  return queryOptions({
    queryKey: libraryKeys.view(sort, page),
    queryFn: ({ client, signal }) => fetchLibraryView(api, client, sort, page, signal),
  });
}
