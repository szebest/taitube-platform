import {
  adminUser,
  creatorUser,
  guestUser,
  sampleChannel,
  standardUser,
} from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canSubscribeChannel, canUpdateChannel } from '../channels';

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

describe('helpers/channels: canUpdateChannel', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an unauthenticated caller', user: null, expected: false },
    { scenario: 'the owner', user: standardUser, expected: true },
    { scenario: 'another user', user: creatorUser, expected: false },
    {
      scenario: 'an editor of the channel',
      user: {
        id: 'editor-1',
        role: 'USER',
        memberships: { 'chan-1': { role: 'editor', ownerId: standardUser.id } },
      },
      expected: true,
    },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    expect(canUpdateChannel({ user, channel: sampleChannel })).toBe(expected);
  });
});
