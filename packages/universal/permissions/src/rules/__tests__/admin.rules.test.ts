import { subject } from '@casl/ability';
import { adminUser, guestUser, sampleComment, standardUser } from '../../__mocks__/fixtures';
import type { AppAction, AppSubjects, UserContext } from '../../types/index';
import { defineAdminRules } from '../admin.rules';
import { buildAbility } from './build-ability';

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
      scenario: 'an admin manages picks',
      user: adminUser,
      action: 'manage',
      target: 'Pick',
      expected: true,
    },
    {
      scenario: 'a standard user does not manage picks',
      user: standardUser,
      action: 'manage',
      target: 'Pick',
      expected: false,
    },
    {
      scenario: 'an admin deletes comments',
      user: adminUser,
      action: 'delete',
      target: 'Comment',
      expected: true,
    },
    {
      scenario: "an admin hearts a comment on someone else's video",
      user: adminUser,
      action: 'heart',
      target: subject('Comment', { ...sampleComment, videoOwnerId: 'creator-1' }),
      expected: false,
    },
    {
      scenario: 'an admin hearts a comment on their own video',
      user: adminUser,
      action: 'heart',
      target: subject('Comment', { ...sampleComment, videoOwnerId: adminUser.id }),
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
