import { ErrorCodes, type Failure } from '@vp/errors';

export type SearchHistoryNotFound = Failure<
  typeof ErrorCodes.SEARCH_HISTORY_NOT_FOUND,
  { entryId: string }
>;

export function searchHistoryNotFound(entryId: string): SearchHistoryNotFound {
  return {
    code: ErrorCodes.SEARCH_HISTORY_NOT_FOUND,
    message: 'Search history entry not found',
    entryId,
  };
}
