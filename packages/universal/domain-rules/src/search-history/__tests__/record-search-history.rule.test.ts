import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideSearchHistoryRecord } from '../record-search-history.rule';

const VIEWER: UserContext = { id: 'u1', role: 'USER' };
const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('@vp/domain-rules: decideSearchHistoryRecord', () => {
  it.each([
    { typed: 'Cats  and DOGS', query: 'Cats and DOGS', queryKey: 'cats and dogs' },
    { typed: ' cats ', query: 'cats', queryKey: 'cats' },
  ])('builds the row for "$typed" as the signed-in viewer', ({ typed, query, queryKey }) => {
    expect(
      expectOk(decideSearchHistoryRecord({ viewer: VIEWER, text: typed, id: 's1', now: NOW }))
    ).toEqual({ id: 's1', userId: 'u1', searchedAt: NOW, query, queryKey });
  });

  it('answers UNAUTHORIZED for a guest', () => {
    expect(
      expectErr(decideSearchHistoryRecord({ viewer: null, text: 'cats', id: 's1', now: NOW })).code
    ).toBe(ErrorCodes.UNAUTHORIZED);
  });
});
