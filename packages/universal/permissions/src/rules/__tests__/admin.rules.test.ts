import { adminUser, guestUser, standardUser } from '../../__mocks__/fixtures.js';
import type { AppAction, AppSubjects, UserContext } from '../../types/index.js';
import { defineAdminRules } from '../admin.rules';
import { buildAbility } from './build-ability.js';

describe('rules/admin.rules: Declarative Admin Ability Rules', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'an admin manages everything',
      user: adminUser,
      action: 'manage',
      target: 'all',
      expected: true,
    },
    {
      scenario: 'an admin reads videos',
      user: adminUser,
      action: 'read',
      target: 'Video',
      expected: true,
    },
    {
      scenario: 'an admin deletes comments',
      user: adminUser,
      action: 'delete',
      target: 'Comment',
      expected: true,
    },
    {
      scenario: 'a standard user manages everything',
      user: standardUser,
      action: 'manage',
      target: 'all',
      expected: false,
    },
    {
      scenario: 'a guest manages everything',
      user: guestUser,
      action: 'manage',
      target: 'all',
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineAdminRules, user).can(action, target)).toBe(expected);
  });
});
