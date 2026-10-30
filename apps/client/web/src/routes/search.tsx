import { createFileRoute } from '@tanstack/react-router';
import { SEARCH_SORTS, SEARCH_TYPES } from '@vp/domain';
import { isOk } from '@vp/result';
import { validateSearchQuery } from '@vp/validation';
import { z } from 'zod';

import { searchQueryOptions } from '#app/features/search/api/search-queries';
import { SearchPage, SearchPageSkeleton } from '#app/features/search/components/search-page';

const SearchTypeSchema = z.enum(SEARCH_TYPES);
const SearchSortSchema = z.enum(SEARCH_SORTS);

const SearchParamsSchema = z.object({
  q: z.string().optional(),
  type: z.preprocess(
    (value) => SearchTypeSchema.safeParse(value).data,
    SearchTypeSchema.optional()
  ),
  sort: z.preprocess(
    (value) => SearchSortSchema.safeParse(value).data,
    SearchSortSchema.optional()
  ),
});

export const Route = createFileRoute('/search')({
  validateSearch: SearchParamsSchema,
  loaderDeps: ({ search: { q, type = 'all', sort = 'relevance' } }) => {
    const query = validateSearchQuery(q ?? '');
    return { query: isOk(query) ? query.value : undefined, type, sort };
  },
  loader: async ({ context: { queryClient, api }, deps: { query, type, sort } }) => {
    if (query === undefined) {
      return;
    }

    await queryClient.ensureInfiniteQueryData(searchQueryOptions(api, { query, type, sort }));
  },
  pendingComponent: SearchPageSkeleton,
  component: SearchPage,
});
