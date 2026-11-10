import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { SEARCH_TYPES, type SearchType } from '@vp/domain';
import { useFormat, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { ChipBar } from '#app/components/discovery/chip-bar';
import { searchQueryOptions } from '#app/features/search/api/search-queries';

const route = getRouteApi('/search');

export interface SearchTypeChipBarProps {
  query: string;
}

/** Narrows the results to one kind; the choice is the `type` search param, replaced rather than stacked. Every kind shows its count, kept from the last page while the next one loads. */
export function SearchTypeChipBar({ query }: SearchTypeChipBarProps) {
  const api = useApi();
  const { type, sort } = route.useLoaderDeps();
  const navigate = route.useNavigate();
  const { format } = useFormat();
  const { tOr } = useT();
  const { data } = useInfiniteQuery({
    ...searchQueryOptions(api, { query, type, sort }),
    placeholderData: keepPreviousData,
  });
  const counts = data?.pages[0]?.counts;

  const countOf = (option: SearchType) => {
    if (counts === undefined) {
      return undefined;
    }

    const value =
      option === 'all' ? counts.video + counts.channel + counts.playlist : counts[option];
    return unwrapOr(format({ type: 'count', value }), '');
  };

  return (
    <ChipBar.Root
      className="min-w-0 flex-1"
      aria-label={tOr('search.filterLabel', {}, '')}
      value={type}
      onValueChange={(next) => {
        const picked = SEARCH_TYPES.find((option) => option === next);
        if (picked) {
          navigate({ search: (previous) => ({ ...previous, type: picked }), replace: true });
        }
      }}
    >
      {SEARCH_TYPES.map((option) => (
        <ChipBar.Item key={option} value={option} count={countOf(option)}>
          {tOr('search.type', { type: option }, '')}
        </ChipBar.Item>
      ))}
    </ChipBar.Root>
  );
}
