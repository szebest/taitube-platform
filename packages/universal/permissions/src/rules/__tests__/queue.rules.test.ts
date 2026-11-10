import { adminUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineQueueRules } from '../queue.rules';
import { buildAbility } from './build-ability';

describe('rules/queue.rules: who may build a playback queue', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'an anonymous caller', user: null, expected: false },
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a guest-role caller', user: { id: 'guest-1', role: 'GUEST' }, expected: false },
    { scenario: 'a viewer', user: standardUser, expected: true },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('$scenario: $expected', ({ user, expected }) => {
    expect(buildAbility(defineQueueRules, user).can('queue', 'Queue')).toBe(expected);
  });
});
