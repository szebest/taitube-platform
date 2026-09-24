import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canSubscribeChannel } from '../channels';

describe('helpers/channels: canSubscribeChannel', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: null, expected: false },
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a standard user', user: standardUser, expected: true },
    { scenario: 'a creator', user: creatorUser, expected: true },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    expect(canSubscribeChannel({ user })).toBe(expected);
  });
});
