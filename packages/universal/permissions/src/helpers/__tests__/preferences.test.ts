import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canReadPreferences, canUpdatePreferences } from '../preferences';

describe('helpers/preferences', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, expected: false },
    { scenario: 'the owner', user: standardUser, expected: true },
    { scenario: 'another user', user: creatorUser, expected: false },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    const preferences = { ownerId: standardUser.id };

    expect(canReadPreferences({ user, preferences })).toBe(expected);
    expect(canUpdatePreferences({ user, preferences })).toBe(expected);
  });
});
