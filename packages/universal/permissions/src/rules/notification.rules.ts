import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

export function defineNotificationRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('read', 'Notification', { ownerId: user.id });
  builder.can('update', 'Notification', { ownerId: user.id });
}
