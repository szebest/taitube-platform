import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import { expectErr, expectOk } from '@vp/testing/result';
import { decodeSearchCursor, searchCursorPayload } from '../search-cursor';

const paginator = new Paginator();
const WALK = { sort: 'relevance', mode: 'fuzzy', instant: 1_700_000_000_000 } as const;
const LAST = { kind: 'channel', key: 2.5, id: 'c-1' } as const;
const PAYLOAD = { ...WALK, key: 2.5, kind: 'channel', id: 'c-1' };

const encoded = (payload: object) => paginator.encodeCursor({ ...PAYLOAD, ...payload });

describe('apps/api/services: search cursor', () => {
  it('carries the hit position and the walk it belongs to', () => {
    expect(searchCursorPayload(LAST, WALK)).toEqual(PAYLOAD);
  });

  it('reads back the cursor it minted', () => {
    expect(expectOk(decodeSearchCursor(encoded({}), 'relevance', paginator))).toEqual(PAYLOAD);
  });

  it('starts a first page without one', () => {
    expect(expectOk(decodeSearchCursor(undefined, 'relevance', paginator))).toBeNull();
  });

  it.each([
    { name: 'another sort', payload: {}, sort: 'date' as const },
    { name: 'an unknown mode', payload: { mode: 'semantic' }, sort: 'relevance' as const },
    { name: 'an unknown kind', payload: { kind: 'comment' }, sort: 'relevance' as const },
    { name: 'a key that is not a number', payload: { key: '2.5' }, sort: 'relevance' as const },
    {
      name: 'an instant that is not a number',
      payload: { instant: 'soon' },
      sort: 'relevance' as const,
    },
    { name: 'an id that is not a string', payload: { id: 7 }, sort: 'relevance' as const },
  ])('refuses a cursor with $name', ({ payload, sort }) => {
    expect(expectErr(decodeSearchCursor(encoded(payload), sort, paginator)).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
