import { queryOptions } from '@tanstack/react-query';
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
};

/**
 * The library is keyset-paginated, so page `n` of a sort is reached by following each page's cursor
 * from the first; a page past the last answers the last one, with the page it is.
 */
async function fetchLibraryView(
  api: ApiClient,
  sort: LibrarySort,
  page: number,
  signal: AbortSignal
): Promise<LibraryView> {
  let current = await api.creatorVideos.listCreatorVideos({
    query: { sort, limit: KEYSET_PAGE_SIZE },
    signal,
  });

  let reached = 1;
  while (reached < page && current.nextCursor !== null) {
    current = await api.creatorVideos.listCreatorVideos({
      query: { sort, limit: KEYSET_PAGE_SIZE, cursor: current.nextCursor },
      signal,
    });
    reached++;
  }

  return { items: current.items, page: reached, hasNextPage: current.nextCursor !== null };
}

export function libraryQueryOptions(api: ApiClient, sort: LibrarySort, page: number) {
  return queryOptions({
    queryKey: libraryKeys.view(sort, page),
    queryFn: ({ signal }) => fetchLibraryView(api, sort, page, signal),
  });
}
