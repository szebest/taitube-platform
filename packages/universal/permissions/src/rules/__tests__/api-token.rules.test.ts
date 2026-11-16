import { subject } from '@casl/ability';
import { adminUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineApiTokenRules } from '../api-token.rules';
import { buildAbility } from './build-ability';

describe('rules/api-token.rules: who manages a token', () => {
  it.each<{ scenario: string; user: UserContext | null; userId: string; expected: boolean }>([
    { scenario: 'nobody signed in', user: null, userId: 'usr-1', expected: false },
    { scenario: 'a guest', user: guestUser, userId: 'usr-1', expected: false },
    { scenario: 'its user', user: standardUser, userId: 'usr-1', expected: true },
    { scenario: 'another user', user: standardUser, userId: 'usr-2', expected: false },
    { scenario: "an admin, on another user's", user: adminUser, userId: 'usr-1', expected: false },
  ])('$scenario: $expected', ({ user, userId, expected }) => {
    const ability = buildAbility(defineApiTokenRules, user);
    const token = subject('ApiToken', { userId });

    expect(
      ['create', 'read', 'delete'].map((action) => ability.can(action as 'read', token))
    ).toEqual([expected, expected, expected]);
  });
});
