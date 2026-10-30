import { type Result, err, ok } from '@vp/result';
import { type SearchHistoryNotFound, searchHistoryNotFound } from './failures';

export interface RemoveSearchHistoryInput {
  readonly entryId: string;
  /** Whether a row of the caller's own went; another user's id deletes nothing, so it is not found. */
  readonly removed: boolean;
}

export function decideSearchHistoryRemoval(
  input: RemoveSearchHistoryInput
): Result<void, SearchHistoryNotFound> {
  return input.removed ? ok() : err(searchHistoryNotFound(input.entryId));
}
