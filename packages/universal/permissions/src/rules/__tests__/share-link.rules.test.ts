import { subject } from '@casl/ability';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility, AppAction, ShareGrant } from '../../types/index';
import { defineShareLinkRules } from '../share-link.rules';

const PRIVATE = { id: 'vid-priv', ownerId: 'creator-1', visibility: 'private' } as const;
const GRANT: ShareGrant = { targetType: 'video', targetId: PRIVATE.id };

function abilityFor(grant: ShareGrant | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineShareLinkRules(grant, builder);
  return builder.build();
}

describe('rules/share-link.rules: what a live share link grants', () => {
  it('lets its holder read the linked private video', () => {
    expect(abilityFor(GRANT).can('read', subject('Video', PRIVATE))).toBe(true);
  });

  it('grants nothing on another video', () => {
    expect(abilityFor(GRANT).can('read', subject('Video', { ...PRIVATE, id: 'vid-other' }))).toBe(
      false
    );
  });

  it.each<AppAction>(['update', 'delete', 'react', 'pin', 'moderate', 'publish'])(
    'grants no %s on the linked video',
    (action) => {
      expect(abilityFor(GRANT).can(action, subject('Video', PRIVATE))).toBe(false);
    }
  );

  it.each<{ subjectType: 'Comment' | 'Analytics'; action: AppAction }>([
    { subjectType: 'Comment', action: 'create' },
    { subjectType: 'Analytics', action: 'read' },
  ])('grants no $action on $subjectType', ({ subjectType, action }) => {
    expect(abilityFor(GRANT).can(action, subjectType)).toBe(false);
  });

  it('grants nothing without a link', () => {
    expect(abilityFor(null).can('read', subject('Video', PRIVATE))).toBe(false);
  });
});
