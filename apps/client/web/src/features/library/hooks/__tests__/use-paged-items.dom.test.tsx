import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { listSearchHistory } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { type PropsWithChildren, Suspense } from 'react';

import { searchItem } from '#app/features/library/__tests__/library-fixtures';
import { searchHistoryQueryOptions } from '#app/features/library/api/library-queries';
import { usePagedItems } from '../use-paged-items';

function render() {
  const client = createQueryClient();
  client.setQueryData(searchHistoryQueryOptions(api).queryKey, {
    pages: [{ items: [searchItem(1), searchItem(2)], nextCursor: 'c1' }],
    pageParams: [undefined],
  });
  return renderHook(() => usePagedItems(searchHistoryQueryOptions(api)), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <Suspense>{children}</Suspense>
      </QueryClientProvider>
    ),
  });
}

describe('apps/client/web: usePagedItems', () => {
  it('flattens the loaded pages and knows another is to come', () => {
    const { result } = render();

    expect(result.current.items.map(({ query }) => query)).toEqual(['search 1', 'search 2']);
    expect(result.current.hasMore).toBe(true);
  });

  it('loads the next page with the cursor and appends its rows', async () => {
    const cursors: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listSearchHistory, ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get('cursor'));
        return HttpResponse.json({ items: [searchItem(3)], nextCursor: null });
      })
    );
    const { result } = render();

    await act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(cursors).toEqual(['c1']);
    expect(result.current.hasMore).toBe(false);
  });
});
