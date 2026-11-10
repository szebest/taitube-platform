import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { type ContractResult, listScreeningCases } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';
import { z } from 'zod';
import { lenient } from './lenient';

type ScreeningPage = ContractResult<typeof listScreeningCases>;
export type ScreeningCase = ScreeningPage['items'][number];
export type ScreeningFinding = ScreeningCase['reasons'][number];
export type ScreeningState = NonNullable<z.output<typeof ScreeningSearchSchema>['state']>;

const { state } = listScreeningCases.query.shape;

export const SCREENING_STATE_OPTIONS = state.unwrap().options;

/** The held and flagged page's filter, as its URL spells it; a state the contract refuses reads as absent. */
export const ScreeningSearchSchema = z.object({ state: lenient(state) });

export const adminScreeningKeys = {
  all: ['admin', 'screening'] as const,
  list: (filter: ScreeningState | undefined) => [...adminScreeningKeys.all, filter] as const,
};

/** The held and flagged cases, open ones first, optionally only open or only decided, keyset-paged. */
export function adminScreeningQueryOptions(api: ApiClient, filter: ScreeningState | undefined) {
  return infiniteQueryOptions({
    queryKey: adminScreeningKeys.list(filter),
    queryFn: ({ pageParam }) =>
      api.screening.listScreeningCases({
        query: { state: filter, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

export type ScreeningPages = InfiniteData<ScreeningPage, string | undefined>;

/** What a case is called in its State column: its decision, else whether it holds or only flags, or an appeal waiting. */
export function screeningStateOf({
  decision,
  outcome,
  appeal,
}: Pick<ScreeningCase, 'decision' | 'outcome' | 'appeal'>) {
  if (decision) {
    return decision;
  }
  if (appeal && appeal.resolvedAt === null) {
    return 'appealed';
  }
  return outcome === 'HOLD' ? 'held' : 'flagged';
}
