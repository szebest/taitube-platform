import { createFileRoute } from '@tanstack/react-router';
import { SEARCH_SORTS, SEARCH_TYPES } from '@vp/domain';
import { isOk } from '@vp/result';
import { validateSearchQuery } from '@vp/validation';
import { z } from 'zod';
import { SearchPage, SearchPageSkeleton, searchQueryOptions } from '#app/features/search';

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

    await queryClient.infiniteQuery({
      ...searchQueryOptions(api, { query, type, sort }),
      staleTime: 'static',
    });
  },
  pendingComponent: SearchPageSkeleton,
  component: SearchPage,
});
