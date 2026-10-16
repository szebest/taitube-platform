import { createFileRoute } from '@tanstack/react-router';
import { isOk } from '@vp/result';
import { validateSearchQuery } from '@vp/validation';
import { z } from 'zod';

import { videoSearchQueryOptions } from '#app/features/search/api/search-queries';
import { SearchPage } from '#app/features/search/components/search-page';

export const Route = createFileRoute('/search')({
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search: { q } }) => {
    const query = validateSearchQuery(q ?? '');
    return { query: isOk(query) ? query.value : undefined };
  },
  loader: async ({ context: { queryClient, api }, deps: { query } }) => {
    if (query === undefined) {
      return;
    }

    await queryClient.ensureInfiniteQueryData(videoSearchQueryOptions(api, query));
  },
  component: SearchPage,
});
