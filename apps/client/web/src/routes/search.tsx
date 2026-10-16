import { createFileRoute } from '@tanstack/react-router';
import { isErr } from '@vp/result';
import { validateSearchQuery } from '@vp/validation';
import { z } from 'zod';

import { videoSearchQueryOptions } from '#app/features/search/api/search-queries';
import { SearchPage } from '#app/features/search/components/search-page';

export const Route = createFileRoute('/search')({
  validateSearch: z.object({ q: z.coerce.string().optional() }),
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ context: { queryClient, api }, deps: { q } }) => {
    const query = validateSearchQuery(q ?? '');
    if (isErr(query)) {
      return query;
    }

    await queryClient.ensureInfiniteQueryData(videoSearchQueryOptions(api, query.value));
    return query;
  },
  component: SearchPage,
});
