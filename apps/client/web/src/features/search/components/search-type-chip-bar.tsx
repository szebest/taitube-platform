import { getRouteApi } from '@tanstack/react-router';
import { SEARCH_TYPES, type SearchType } from '@vp/domain';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

import { ChipBar } from '#app/components/discovery/chip-bar';

const route = getRouteApi('/search');

export interface SearchTypeChipBarProps {
  counts: Partial<Record<SearchType, number>>;
}

/** Narrows the results to one kind; the choice is the `type` search param, replaced rather than stacked. */
export function SearchTypeChipBar({ counts }: SearchTypeChipBarProps) {
  const { type } = route.useLoaderDeps();
  const navigate = route.useNavigate();
  const { format } = useFormat();
  const { tOr } = useT();

  return (
    <ChipBar.Root
      aria-label={tOr('search.filterLabel', {}, '')}
      value={type}
      onValueChange={(next) => {
        const picked = SEARCH_TYPES.find((option) => option === next);
        if (picked) {
          navigate({ search: (previous) => ({ ...previous, type: picked }), replace: true });
        }
      }}
    >
      {SEARCH_TYPES.map((option) => {
        const count = counts[option];
        return (
          <ChipBar.Item
            key={option}
            value={option}
            count={
              count === undefined
                ? undefined
                : unwrapOr(format({ type: 'count', value: count }), '')
            }
          >
            {tOr('search.type', { type: option }, '')}
          </ChipBar.Item>
        );
      })}
    </ChipBar.Root>
  );
}
