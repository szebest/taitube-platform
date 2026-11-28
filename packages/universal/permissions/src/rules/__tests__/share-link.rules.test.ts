import { subject } from '@casl/ability';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility, AppAction, ShareGrant } from '../../types/index';
import { defineShareLinkRules } from '../share-link.rules';

const PRIVATE = { id: 'vid-priv', ownerId: 'creator-1', visibility: 'private' } as const;
const GRANT: ShareGrant = { targetType: 'video', targetId: PRIVATE.id };
const PLAYLIST_GRANT: ShareGrant = { targetType: 'playlist', targetId: PRIVATE.id };

function abilityFor(grant: ShareGrant | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineShareLinkRules(grant, builder);
  return builder.build();
}

describe('rules/share-link.rules: what a live share link grants', () => {
  it.each([
    {
      scenario: 'the linked private video',
      target: subject('Video', { ...PRIVATE }),
      expected: true,
    },
    {
      scenario: 'another video',
      target: subject('Video', { ...PRIVATE, id: 'vid-other' }),
      expected: false,
    },
    {
      scenario: 'a playlist with the same id',
      target: subject('Playlist', { ...PRIVATE }),
      expected: false,
    },
  ])('a video link reads $scenario: $expected', ({ target, expected }) => {
    expect(abilityFor(GRANT).can('read', target)).toBe(expected);
  });

  it.each([
    {
      scenario: 'the linked private playlist',
      target: subject('Playlist', { ...PRIVATE }),
      expected: true,
    },
    {
      scenario: 'another playlist',
      target: subject('Playlist', { ...PRIVATE, id: 'pl-other' }),
      expected: false,
    },
    {
      scenario: 'a video with the same id',
      target: subject('Video', { ...PRIVATE }),
      expected: false,
    },
  ])('a playlist link reads $scenario: $expected', ({ target, expected }) => {
    expect(abilityFor(PLAYLIST_GRANT).can('read', target)).toBe(expected);
  });

  it.each<AppAction>(['update', 'delete', 'addItem', 'subscribe', 'pin'])(
    'grants no %s on the linked playlist',
    (action) => {
      expect(abilityFor(PLAYLIST_GRANT).can(action, subject('Playlist', { ...PRIVATE }))).toBe(
        false
      );
    }
  );

  it.each<AppAction>(['update', 'delete', 'react', 'pin', 'moderate', 'publish'])(
    'grants no %s on the linked video',
    (action) => {
      expect(abilityFor(GRANT).can(action, subject('Video', { ...PRIVATE }))).toBe(false);
    }
  );

  it.each<{ subjectType: 'Comment' | 'Analytics'; action: AppAction }>([
    { subjectType: 'Comment', action: 'create' },
    { subjectType: 'Analytics', action: 'read' },
  ])('grants no $action on $subjectType', ({ subjectType, action }) => {
    expect(abilityFor(GRANT).can(action, subjectType)).toBe(false);
  });

  it('grants nothing without a link', () => {
    expect(abilityFor(null).can('read', subject('Video', { ...PRIVATE }))).toBe(false);
  });
});
