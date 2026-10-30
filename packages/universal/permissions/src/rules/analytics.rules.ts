import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

export function defineAnalyticsRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('read', 'Analytics', { ownerId: user.id });
}
