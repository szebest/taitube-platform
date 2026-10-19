import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

export function definePreferencesRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('read', 'Preferences', { ownerId: user.id });
  builder.can('update', 'Preferences', { ownerId: user.id });
}
