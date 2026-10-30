import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideSearchHistoryRemoval } from '../remove-search-history.rule';

describe('@vp/domain-rules: decideSearchHistoryRemoval', () => {
  it('accepts a removal that deleted a row', () => {
    expectOk(decideSearchHistoryRemoval({ entryId: 's1', removed: true }));
  });

  it('is not found when nothing of the caller went', () => {
    expect(expectErr(decideSearchHistoryRemoval({ entryId: 's1', removed: false }))).toMatchObject({
      code: ErrorCodes.SEARCH_HISTORY_NOT_FOUND,
      entryId: 's1',
    });
  });
});
