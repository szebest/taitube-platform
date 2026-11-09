import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ipHashOf, requirePrincipal, toNewSeat } from '../watch-party-principals';
import { guestSession } from './watch-party-access-fixture';
import {
  ANONYMOUS,
  discordSession,
  guestCaller,
  OWNER,
  START,
  userCaller,
} from './watch-party-test-deps';

describe('apps/server/api/services: requirePrincipal', () => {
  it.each([
    { scenario: 'an account', caller: userCaller(OWNER), kind: 'user' },
    { scenario: 'a guest credential', caller: guestCaller(guestSession()), kind: 'guest' },
    { scenario: 'a Discord credential', caller: guestCaller(discordSession()), kind: 'discord' },
  ])('finds $scenario', ({ caller, kind }) => {
    expect(expectOk(requirePrincipal(caller, 'join')).kind).toBe(kind);
  });

  it('sends a caller with neither to sign in, naming the action', () => {
    expect(expectErr(requirePrincipal(ANONYMOUS, 'join'))).toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
      action: 'join',
      subject: 'WatchParty',
    });
  });
});

describe('apps/server/api/services: toNewSeat', () => {
  const base = {
    roomId: 'room',
    joinedVia: 'link' as const,
    joinedAt: new Date(START),
    ipHash: null,
  };

  it.each([
    {
      scenario: 'an account, whose name is read live',
      principal: { kind: 'user' as const, userId: 'u1' },
      expected: {
        memberKey: 'user:u1',
        userId: 'u1',
        discordUserId: null,
        displayName: null,
        avatarUrl: null,
      },
    },
    {
      scenario: 'a Discord member, whose name is kept',
      principal: {
        kind: 'discord' as const,
        discordUserId: '123456789012345678',
        name: 'Dana',
        avatarUrl: 'a.png',
      },
      expected: {
        memberKey: 'discord:123456789012345678',
        userId: null,
        discordUserId: '123456789012345678',
        displayName: 'Dana',
        avatarUrl: 'a.png',
      },
    },
    {
      scenario: 'a guest, whose generated name is kept',
      principal: { kind: 'guest' as const, guestId: 'abcdefghijklmnop', name: 'Guest 4821' },
      expected: {
        memberKey: 'guest:abcdefghijklmnop',
        userId: null,
        discordUserId: null,
        displayName: 'Guest 4821',
        avatarUrl: null,
      },
    },
  ])('seats $scenario', ({ principal, expected }) => {
    expect(toNewSeat({ ...base, principal })).toEqual({
      ...base,
      kind: principal.kind,
      ...expected,
    });
  });
});

describe('apps/server/api/services: ipHashOf', () => {
  it.each([
    { scenario: 'a guest credential', caller: guestCaller(guestSession()), expected: 'ip:guest' },
    { scenario: 'a Discord credential', caller: guestCaller(discordSession()), expected: null },
    { scenario: 'an account', caller: userCaller(OWNER), expected: null },
    {
      scenario: 'a guest who signed in, held as the account',
      caller: { ...userCaller(OWNER), party: guestSession() },
      expected: null,
    },
    { scenario: 'nobody', caller: ANONYMOUS, expected: null },
  ])('is $expected for $scenario', ({ caller, expected }) => {
    expect(ipHashOf(caller)).toBe(expected);
  });
});
