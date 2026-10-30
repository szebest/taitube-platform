import { ErrorCodes, isInputFailure } from '@vp/errors';
import { searchHistoryNotFound } from '../failures';

describe('@vp/domain-rules: search history failures', () => {
  it('names the entry that is not in the caller history, off the wire', () => {
    const failure = searchHistoryNotFound('s1');

    expect(failure).toMatchObject({ code: ErrorCodes.SEARCH_HISTORY_NOT_FOUND, entryId: 's1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});
