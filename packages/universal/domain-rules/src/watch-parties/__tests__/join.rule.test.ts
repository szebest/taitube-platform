import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideWatchPartyJoin, joinNeedsPassword, type WatchPartyJoinInput } from '../join.rule';
import { ROOM_ID } from './room-fixtures';

type Overrides = Omit<Partial<WatchPartyJoinInput>, 'room' | 'capacity'> & {
  room?: Partial<WatchPartyJoinInput['room']>;
  capacity?: Partial<WatchPartyJoinInput['capacity']>;
};

function joinOf({ room, capacity, ...overrides }: Overrides = {}): WatchPartyJoinInput {
  return {
    room: {
      id: ROOM_ID,
      status: 'open',
      visibility: 'unlisted',
      allowGuests: true,
      passwordHash: null,
      ...room,
    },
    kind: 'user',
    isMember: false,
    banned: false,
    grant: null,
    password: 'none',
    entry: 'link',
    capacity: { present: 3, limit: 10, shown: 10, alreadyPresent: false, ...capacity },
    ...overrides,
  };
}

const LOCKED = { passwordHash: 'scrypt$hash' };

describe('@vp/domain-rules: decideWatchPartyJoin', () => {
  it.each<{ scenario: string; input: Overrides; via: string | null }>([
    { scenario: 'a link to an unlisted room', input: {}, via: 'link' },
    { scenario: 'a discovery card', input: { entry: 'discovery' }, via: 'discovery' },
    { scenario: 'a member again', input: { isMember: true, room: LOCKED }, via: null },
    { scenario: 'a guest where guests are allowed', input: { kind: 'guest' }, via: 'link' },
    { scenario: 'the right password', input: { room: LOCKED, password: 'valid' }, via: 'password' },
    {
      scenario: 'an invite past the password',
      input: { room: LOCKED, grant: 'invite' },
      via: 'invite',
    },
    {
      scenario: 'an invite link into a private room',
      input: { room: { visibility: 'private' }, grant: 'invite_link' },
      via: 'invite_link',
    },
    {
      scenario: 'a rejoin of someone already present in a full room',
      input: { isMember: true, capacity: { present: 10, alreadyPresent: true } },
      via: null,
    },
    {
      scenario: 'the owner at the ceiling',
      input: { isMember: true, capacity: { present: 200, limit: null } },
      via: null,
    },
  ])('admits $scenario', ({ input, via }) => {
    expect(expectOk(decideWatchPartyJoin(joinOf(input)))).toEqual({ via });
  });

  it.each<{ scenario: string; input: Overrides; code: string }>([
    {
      scenario: 'a closed room, before anything else',
      input: { room: { status: 'closed' }, banned: true },
      code: ErrorCodes.WATCH_PARTY_CLOSED,
    },
    {
      scenario: 'a banned member, whatever grant they hold',
      input: { banned: true, isMember: true, grant: 'invite' },
      code: ErrorCodes.WATCH_PARTY_BANNED,
    },
    {
      scenario: 'a guest where guests are off',
      input: { kind: 'guest', room: { allowGuests: false } },
      code: ErrorCodes.WATCH_PARTY_GUESTS_OFF,
    },
    {
      scenario: 'a private room without a grant',
      input: { room: { visibility: 'private' } },
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'a revoked invite link into a private room',
      input: { room: { visibility: 'private' }, grant: 'invalid' },
      code: ErrorCodes.WATCH_PARTY_INVITE_INVALID,
    },
    {
      scenario: 'no password sent',
      input: { room: LOCKED },
      code: ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED,
    },
    {
      scenario: 'a wrong password',
      input: { room: LOCKED, password: 'invalid' },
      code: ErrorCodes.WATCH_PARTY_PASSWORD_INVALID,
    },
    {
      scenario: 'an eleventh member at capacity 10',
      input: { capacity: { present: 10 } },
      code: ErrorCodes.WATCH_PARTY_FULL,
    },
    {
      scenario: 'an invitee at capacity 10',
      input: { grant: 'invite', capacity: { present: 10 } },
      code: ErrorCodes.WATCH_PARTY_FULL,
    },
    {
      scenario: 'a join after lowering capacity to 10 with 12 present',
      input: { capacity: { present: 12 } },
      code: ErrorCodes.WATCH_PARTY_FULL,
    },
  ])('refuses $scenario', ({ input, code }) => {
    expect(expectErr(decideWatchPartyJoin(joinOf(input))).code).toBe(code);
  });

  it('says how full the room is', () => {
    expect(expectErr(decideWatchPartyJoin(joinOf({ capacity: { present: 13 } })))).toMatchObject({
      present: 13,
      capacity: 10,
    });
  });

  it('admits again once present drops below a lowered capacity', () => {
    expect(decideWatchPartyJoin(joinOf({ capacity: { present: 9 } })).ok).toBe(true);
  });
});

describe('@vp/domain-rules: joinNeedsPassword', () => {
  it.each([
    { scenario: 'a room without one', input: {}, needs: false },
    { scenario: 'a stranger to a locked room', input: { room: LOCKED }, needs: true },
    { scenario: 'a member', input: { room: LOCKED, isMember: true }, needs: false },
    { scenario: 'an invitee', input: { room: LOCKED, grant: 'invite' as const }, needs: false },
    { scenario: 'a failed grant', input: { room: LOCKED, grant: 'invalid' as const }, needs: true },
  ])('$scenario: $needs', ({ input, needs }) => {
    expect(joinNeedsPassword(joinOf(input))).toBe(needs);
  });
});
