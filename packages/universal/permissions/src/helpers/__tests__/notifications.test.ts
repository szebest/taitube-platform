import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canReadNotification, canUpdateNotification } from '../notifications';

describe('helpers/notification', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, expected: false },
    { scenario: 'the owner', user: standardUser, expected: true },
    { scenario: 'another user', user: creatorUser, expected: false },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    const notification = { ownerId: standardUser.id };

    expect(canReadNotification({ user, notification })).toBe(expected);
    expect(canUpdateNotification({ user, notification })).toBe(expected);
  });
});
