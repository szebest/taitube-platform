import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

export function defineLiveStreamRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('update', 'LiveStream', { ownerId: user.id });
  builder.can('moderate', 'LiveStream', { ownerId: user.id });
  if (user.role === 'MODERATOR') builder.can('moderate', 'LiveStream');
}
