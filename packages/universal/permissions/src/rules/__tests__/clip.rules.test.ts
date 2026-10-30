import { subject } from '@casl/ability';
import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { AppAction, UserContext } from '../../types/index';
import { defineClipRules } from '../clip.rules';
import { buildAbility } from './build-ability';

type Visibility = 'public' | 'unlisted' | 'private';

describe('rules/clip.rules: who may clip a video and delete a clip', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    clip: { userId?: string; visibility?: Visibility };
    expected: boolean;
  }>([
    {
      scenario: 'a guest clips a public video',
      user: guestUser,
      action: 'create',
      clip: { visibility: 'public' },
      expected: false,
    },
    {
      scenario: 'a viewer clips a public video',
      user: standardUser,
      action: 'create',
      clip: { visibility: 'public' },
      expected: true,
    },
    {
      scenario: 'a viewer clips an unlisted video',
      user: standardUser,
      action: 'create',
      clip: { visibility: 'unlisted' },
      expected: false,
    },
    {
      scenario: 'a viewer clips a private video',
      user: standardUser,
      action: 'create',
      clip: { visibility: 'private' },
      expected: false,
    },
    {
      scenario: 'a guest deletes a clip',
      user: guestUser,
      action: 'delete',
      clip: { userId: standardUser.id },
      expected: false,
    },
    {
      scenario: 'the creator deletes their clip',
      user: standardUser,
      action: 'delete',
      clip: { userId: standardUser.id },
      expected: true,
    },
    {
      scenario: 'another viewer deletes the clip',
      user: creatorUser,
      action: 'delete',
      clip: { userId: standardUser.id },
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, clip, expected }) => {
    expect(buildAbility(defineClipRules, user).can(action, subject('Clip', clip))).toBe(expected);
  });

  it('leaves the admin grant to the admin rules', () => {
    expect(
      buildAbility(defineClipRules, adminUser).can('delete', subject('Clip', { userId: 'x' }))
    ).toBe(false);
  });
});
