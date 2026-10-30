import { type NewSearchHistoryEntry, searchHistoryText } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type Result, map } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';

export interface RecordSearchHistoryInput {
  readonly viewer: UserContext | null;
  readonly text: string;
  readonly id: string;
  readonly now: Date;
}

/** Only a signed-in viewer has a trail; the row carries the text as typed and the key that dedupes it. */
export function decideSearchHistoryRecord(
  input: RecordSearchHistoryInput
): Result<NewSearchHistoryEntry, AuthorizationFailure> {
  const { viewer, text, id, now } = input;
  return map(authorize(viewer, true, { action: 'record', subject: 'SearchHistory' }), (user) => ({
    id,
    userId: user.id,
    searchedAt: now,
    ...searchHistoryText(text),
  }));
}
