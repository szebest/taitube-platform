import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';

import { AppProviders } from '#app/__tests__/providers';
import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { SHORTS } from '#app/features/shorts/__tests__/short-fixtures';
import { useShortsFeed } from '../use-shorts-feed';

describe('apps/client/web: useShortsFeed', () => {
  it('lists the Shorts of every page it has, and says whether there are more', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(shortsFeedQueryOptions(api).queryKey, {
      pages: [
        { items: SHORTS.slice(0, 2), nextCursor: 'after-2', total: 4 },
        { items: SHORTS.slice(2), nextCursor: null, total: 4 },
      ],
      pageParams: [undefined, 'after-2'],
    });

    const { result } = renderHook(() => useShortsFeed(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <AppProviders>{children}</AppProviders>
        </QueryClientProvider>
      ),
    });

    expect(result.current.videos.map(({ id }) => id)).toEqual(SHORTS.map(({ id }) => id));
    expect(result.current.hasMore).toBe(false);
  });
});
