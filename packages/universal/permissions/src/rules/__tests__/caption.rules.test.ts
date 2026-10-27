import { subject } from '@casl/ability';
import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { AppAction, UserContext } from '../../types/index';
import { defineCaptionRules } from '../caption.rules';
import { buildAbility } from './build-ability';

type Visibility = 'public' | 'unlisted' | 'private';

const captionsOf = (visibility: Visibility) =>
  subject('Caption', { videoId: 'vid-1', ownerId: creatorUser.id, visibility });

describe('rules/caption.rules: who may read and change the captions of a video', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    visibility: Visibility;
    expected: boolean;
  }>([
    {
      scenario: 'a guest reads a public one',
      user: guestUser,
      action: 'read',
      visibility: 'public',
      expected: true,
    },
    {
      scenario: 'a guest reads an unlisted one',
      user: guestUser,
      action: 'read',
      visibility: 'unlisted',
      expected: true,
    },
    {
      scenario: 'a guest reads a private one',
      user: guestUser,
      action: 'read',
      visibility: 'private',
      expected: false,
    },
    {
      scenario: 'a stranger reads a private one',
      user: standardUser,
      action: 'read',
      visibility: 'private',
      expected: false,
    },
    {
      scenario: 'a moderator reads a private one',
      user: moderatorUser,
      action: 'read',
      visibility: 'private',
      expected: true,
    },
    {
      scenario: 'the owner reads a private one',
      user: creatorUser,
      action: 'read',
      visibility: 'private',
      expected: true,
    },
    {
      scenario: 'the owner manages their own',
      user: creatorUser,
      action: 'manage',
      visibility: 'public',
      expected: true,
    },
    {
      scenario: 'a stranger manages a public one',
      user: standardUser,
      action: 'manage',
      visibility: 'public',
      expected: false,
    },
    {
      scenario: 'a moderator manages a public one',
      user: moderatorUser,
      action: 'manage',
      visibility: 'public',
      expected: false,
    },
    {
      scenario: 'a guest manages a public one',
      user: guestUser,
      action: 'manage',
      visibility: 'public',
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, visibility, expected }) => {
    expect(buildAbility(defineCaptionRules, user).can(action, captionsOf(visibility))).toBe(
      expected
    );
  });

  it('leaves the admin grant to the admin rules', () => {
    expect(buildAbility(defineCaptionRules, adminUser).can('manage', captionsOf('private'))).toBe(
      false
    );
  });
});
