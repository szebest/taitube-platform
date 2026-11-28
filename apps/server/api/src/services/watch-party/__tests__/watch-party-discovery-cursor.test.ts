import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { WATCH_PARTY_DISCOVERY_SORTS, type WatchPartyDiscoverySort } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decodeDiscoveryCursor, discoveryCursorPayload } from '../watch-party-discovery-cursor';

const paginator = new Paginator();
const ID = '018f0000-0000-7000-8000-000000000001';
const AT = new Date('2026-03-01T12:00:00.000Z');

const POSITIONS = {
  members: { sort: 'members', key: 12, id: ID },
  newest: { sort: 'newest', key: AT, id: ID },
  starting_soon: { sort: 'starting_soon', key: AT, id: ID },
  trending: { sort: 'trending', key: 0.4375, id: ID },
} as const;

const cursorOf = (payload: object) =>
  paginator.encodeCursor(payload as Parameters<typeof paginator.encodeCursor>[0]);

function decode(cursor: string | undefined, sort: WatchPartyDiscoverySort) {
  return decodeDiscoveryCursor(cursor, sort, paginator);
}

describe('apps/server/api/services: the discovery cursor', () => {
  it.each(WATCH_PARTY_DISCOVERY_SORTS)('round-trips a %s position with its mode', (sort) => {
    const position = POSITIONS[sort];
    const cursor = paginator.encodeCursor(discoveryCursorPayload(position, 'fuzzy'));

    expect(expectOk(decode(cursor, sort))).toEqual({ position, mode: 'fuzzy' });
  });

  it('starts from the first page without a cursor', () => {
    expect(expectOk(decode(undefined, 'members'))).toBeNull();
  });

  it('refuses a cursor under a sort other than the one it was minted for', () => {
    const cursor = paginator.encodeCursor(discoveryCursorPayload(POSITIONS.newest, 'lexical'));

    expect(expectErr(decode(cursor, 'members')).code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it.each([
    { scenario: 'a mode it does not know', sort: 'members', mode: 'exact', key: 1, id: ID },
    {
      scenario: 'an id that is not a UUID',
      sort: 'members',
      mode: 'lexical',
      key: 1,
      id: "1' or '1",
    },
    {
      scenario: 'a member count past a 32-bit integer',
      sort: 'members',
      mode: 'lexical',
      key: 2 ** 31,
      id: ID,
    },
    { scenario: 'a negative member count', sort: 'members', mode: 'lexical', key: -1, id: ID },
    {
      scenario: 'a date past the year 9999',
      sort: 'newest',
      mode: 'lexical',
      key: '+275760-09-13T00:00:00.000Z',
      id: ID,
    },
    {
      scenario: 'a score that is not a number',
      sort: 'trending',
      mode: 'lexical',
      key: 'high',
      id: ID,
    },
  ] as const)('refuses a cursor with $scenario', ({ scenario: _scenario, ...payload }) => {
    expect(expectErr(decode(cursorOf(payload), payload.sort)).code).toBe(ErrorCodes.INVALID_CURSOR);
  });
});
