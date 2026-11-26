import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canReadAnalytics, canReadVideoStats } from '../analytics';

const CHANNEL_ID = 'chan-creator-1';

describe('helpers/analytics: canReadAnalytics', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, expected: false },
    { scenario: 'the owning creator', user: creatorUser, expected: true },
    { scenario: 'another user', user: standardUser, expected: false },
    { scenario: 'a moderator', user: moderatorUser, expected: false },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    expect(
      canReadAnalytics({ user, analytics: { ownerId: creatorUser.id, channelId: CHANNEL_ID } })
    ).toBe(expected);
  });
});

describe('helpers/analytics: canReadVideoStats', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, expected: false },
    { scenario: 'the owning creator', user: creatorUser, expected: true },
    { scenario: 'another user', user: standardUser, expected: false },
    { scenario: 'a moderator', user: moderatorUser, expected: false },
  ])('$scenario: $expected', ({ user, expected }) => {
    expect(
      canReadVideoStats({ user, video: { ownerId: creatorUser.id, channelId: CHANNEL_ID } })
    ).toBe(expected);
  });
});
