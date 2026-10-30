import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { isOk } from '@vp/result';
import { validateSearchQuery } from '@vp/validation';

import { useDebouncedValue } from '#app/hooks/use-debounced-value';
import { palettePreviewQueryOptions, searchSuggestionsQueryOptions } from '../api/search-queries';
import { groupPaletteResults } from '../palette-results';

const SUGGESTION_DEBOUNCE_MS = 200;

/**
 * What the palette shows for the words typed: suggestions and the first hits of each kind, for the
 * term that has held still 200 ms. The previous term's results stay until the next ones arrive.
 */
export function useSearchSuggestions(typed: string, enabled: boolean) {
  const api = useApi();
  const settled = useDebouncedValue(typed, SUGGESTION_DEBOUNCE_MS);
  const validated = validateSearchQuery(settled);
  const term = isOk(validated) ? validated.value : undefined;
  const active = enabled && term !== undefined;

  const suggestions = useQuery({
    ...searchSuggestionsQueryOptions(api, term ?? ''),
    enabled: active,
    placeholderData: keepPreviousData,
  });
  const preview = useQuery({
    ...palettePreviewQueryOptions(api, term ?? ''),
    enabled: active,
    placeholderData: keepPreviousData,
  });

  const groups = groupPaletteResults(
    term === undefined ? [] : (preview.data?.items ?? []),
    term === undefined ? [] : (suggestions.data?.items ?? [])
  );

  return {
    groups,
    loading: settled !== typed || suggestions.isFetching || preview.isFetching,
    failed: active && (suggestions.isError || preview.isError),
    retry: () => Promise.all([suggestions.refetch(), preview.refetch()]),
    searched: term !== undefined,
  };
}
