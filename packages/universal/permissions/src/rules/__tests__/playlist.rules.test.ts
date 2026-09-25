import { subject } from '@casl/ability';
import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { AppAction, UserContext } from '../../types/index';
import { definePlaylistRules } from '../playlist.rules';
import { buildAbility } from './build-ability';

const owned = (visibility: 'public' | 'unlisted' | 'private') =>
  subject('Playlist', { id: 'pl-1', ownerId: creatorUser.id, visibility });

describe('rules/playlist.rules: who may read and curate a playlist', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    visibility: 'public' | 'unlisted' | 'private';
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
      scenario: 'the owner reads their private one',
      user: creatorUser,
      action: 'read',
      visibility: 'private',
      expected: true,
    },
    {
      scenario: 'the owner edits their own',
      user: creatorUser,
      action: 'update',
      visibility: 'public',
      expected: true,
    },
    {
      scenario: 'the owner deletes their own',
      user: creatorUser,
      action: 'delete',
      visibility: 'private',
      expected: true,
    },
    {
      scenario: 'a stranger edits a public one',
      user: standardUser,
      action: 'update',
      visibility: 'public',
      expected: false,
    },
    {
      scenario: 'a stranger deletes a public one',
      user: standardUser,
      action: 'delete',
      visibility: 'public',
      expected: false,
    },
    {
      scenario: 'a guest edits a public one',
      user: guestUser,
      action: 'update',
      visibility: 'public',
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, visibility, expected }) => {
    expect(buildAbility(definePlaylistRules, user).can(action, owned(visibility))).toBe(expected);
  });

  it.each([
    { scenario: 'a signed-in user', user: standardUser, expected: true },
    { scenario: 'a guest', user: guestUser, expected: false },
  ])('lets $scenario create a playlist: $expected', ({ user, expected }) => {
    expect(buildAbility(definePlaylistRules, user).can('create', 'Playlist')).toBe(expected);
  });

  it('leaves the admin grant to the admin rules', () => {
    expect(buildAbility(definePlaylistRules, adminUser).can('update', owned('private'))).toBe(
      false
    );
  });
});
