import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideWatchPartySeatUpgrade, type WatchPartySeatUpgradeInput } from '../seat-upgrade.rule';
import { ROOM_ID } from './room-fixtures';

function upgradeOf(
  overrides: Partial<WatchPartySeatUpgradeInput> = {}
): WatchPartySeatUpgradeInput {
  return {
    roomId: ROOM_ID,
    guestSeat: true,
    next: 'user',
    banned: false,
    hasSeat: false,
    ...overrides,
  };
}

describe('@vp/domain-rules: decideWatchPartySeatUpgrade', () => {
  it.each([
    { scenario: 'to a new account', overrides: {}, supersedes: false },
    { scenario: 'to a Discord member', overrides: { next: 'discord' as const }, supersedes: false },
    {
      scenario: 'to an account already seated here',
      overrides: { hasSeat: true },
      supersedes: true,
    },
  ])('moves the seat $scenario', ({ overrides, supersedes }) => {
    expect(expectOk(decideWatchPartySeatUpgrade(upgradeOf(overrides)))).toEqual({ supersedes });
  });

  it.each([
    {
      scenario: 'no guest seat in the room',
      overrides: { guestSeat: false },
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'another guest credential',
      overrides: { next: 'guest' as const },
      code: ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID,
    },
    {
      scenario: 'a banned new key',
      overrides: { banned: true },
      code: ErrorCodes.WATCH_PARTY_BANNED,
    },
  ])('refuses $scenario', ({ overrides, code }) => {
    expect(expectErr(decideWatchPartySeatUpgrade(upgradeOf(overrides))).code).toBe(code);
  });
});
