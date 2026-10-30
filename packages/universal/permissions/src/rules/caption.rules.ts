import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

/** Whoever may watch the video may read its captions; only its owner may change them. */
export function defineCaptionRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  can('read', 'Caption', { visibility: 'public' });
  can('read', 'Caption', { visibility: 'unlisted' });

  if (!user) return;

  if (user.role === 'MODERATOR') can('read', 'Caption');

  if (isSignedInRole(user.role)) {
    can('read', 'Caption', { ownerId: user.id });
    can('manage', 'Caption', { ownerId: user.id });
  }
}
