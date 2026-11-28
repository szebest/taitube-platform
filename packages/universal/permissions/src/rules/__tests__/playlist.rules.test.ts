import { subject } from '@casl/ability';
import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { AppAction, PlaylistResource, UserContext } from '../../types/index';
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

  const seated = (role: 'editor' | 'contributor', fields: PlaylistResource = {}) =>
    subject('Playlist', {
      id: 'pl-1',
      ownerId: creatorUser.id,
      visibility: 'private' as const,
      collaboratorId: standardUser.id,
      collaboratorRole: role,
      ...fields,
    });

  it.each<{
    scenario: string;
    role: 'editor' | 'contributor';
    action: AppAction;
    fields?: PlaylistResource;
    field?: string;
    expected: boolean;
  }>([
    {
      scenario: 'an editor reads the private list',
      role: 'editor',
      action: 'read',
      expected: true,
    },
    { scenario: 'a contributor reads it', role: 'contributor', action: 'read', expected: true },
    { scenario: 'an editor adds', role: 'editor', action: 'addItem', expected: true },
    { scenario: 'an editor reorders', role: 'editor', action: 'manageItems', expected: true },
    {
      scenario: "an editor removes someone else's item",
      role: 'editor',
      action: 'removeItem',
      fields: { addedBy: 'someone' },
      expected: true,
    },
    {
      scenario: 'an editor renames',
      role: 'editor',
      action: 'update',
      field: 'title',
      expected: true,
    },
    {
      scenario: 'an editor changes the visibility',
      role: 'editor',
      action: 'update',
      field: 'visibility',
      expected: false,
    },
    { scenario: 'an editor deletes', role: 'editor', action: 'delete', expected: false },
    {
      scenario: 'an editor seats people',
      role: 'editor',
      action: 'manageCollaborators',
      expected: false,
    },
    { scenario: 'a contributor adds', role: 'contributor', action: 'addItem', expected: true },
    {
      scenario: 'a contributor removes their own item',
      role: 'contributor',
      action: 'removeItem',
      fields: { addedBy: standardUser.id },
      expected: true,
    },
    {
      scenario: "a contributor removes someone else's item",
      role: 'contributor',
      action: 'removeItem',
      fields: { addedBy: 'someone' },
      expected: false,
    },
    {
      scenario: 'a contributor annotates their own item',
      role: 'contributor',
      action: 'manageItems',
      fields: { addedBy: standardUser.id },
      expected: true,
    },
    {
      scenario: 'a contributor reorders the list',
      role: 'contributor',
      action: 'manageItems',
      expected: false,
    },
    { scenario: 'a contributor renames', role: 'contributor', action: 'update', expected: false },
  ])('with a seat, $scenario: $expected', ({ role, action, fields, field, expected }) => {
    expect(
      buildAbility(definePlaylistRules, standardUser).can(action, seated(role, fields), field)
    ).toBe(expected);
  });

  it.each<{ scenario: string; user: UserContext | null; action: AppAction; expected: boolean }>([
    { scenario: 'the owner pins', user: creatorUser, action: 'pin', expected: true },
    { scenario: 'a stranger pins', user: standardUser, action: 'pin', expected: false },
    { scenario: 'a stranger follows', user: standardUser, action: 'subscribe', expected: true },
    { scenario: 'the owner follows', user: creatorUser, action: 'subscribe', expected: false },
    { scenario: 'a guest follows', user: guestUser, action: 'subscribe', expected: false },
  ])('on a public list, $scenario: $expected', ({ user, action, expected }) => {
    expect(buildAbility(definePlaylistRules, user).can(action, owned('public'))).toBe(expected);
  });

  it.each([
    { scenario: 'the owner', user: creatorUser, expected: true },
    { scenario: 'a stranger', user: standardUser, expected: false },
    { scenario: 'a guest', user: guestUser, expected: false },
  ])('lets $scenario read the stats: $expected', ({ user, expected }) => {
    const stats = subject('PlaylistStats', { ownerId: creatorUser.id });

    expect(buildAbility(definePlaylistRules, user).can('read', stats)).toBe(expected);
  });

  it.each([
    { scenario: 'an editor', role: 'editor' as const },
    { scenario: 'a contributor', role: 'contributor' as const },
  ])('keeps the rules, pins and stats from $scenario', ({ role }) => {
    const ability = buildAbility(definePlaylistRules, standardUser);

    expect([
      ability.can('update', seated(role), 'rules'),
      ability.can('update', seated(role), 'autoRemoveWatched'),
      ability.can('pin', seated(role)),
      ability.can('read', subject('PlaylistStats', { ownerId: creatorUser.id })),
    ]).toEqual([false, false, false, false]);
  });

  it('grants nothing on a seat resolved for someone else', () => {
    const ability = buildAbility(definePlaylistRules, creatorUser);
    const other = subject('Playlist', {
      ownerId: 'someone',
      visibility: 'private',
      collaboratorId: standardUser.id,
      collaboratorRole: 'editor',
    } satisfies PlaylistResource);

    expect([ability.can('read', other), ability.can('addItem', other)]).toEqual([false, false]);
  });

  it('leaves the admin grant to the admin rules', () => {
    expect(buildAbility(definePlaylistRules, adminUser).can('update', owned('private'))).toBe(
      false
    );
  });
});
