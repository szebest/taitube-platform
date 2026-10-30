import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';

export function defineChannelRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  can('read', 'Channel');

  if (!user) {
    return;
  }

  const role = user.role;

  if (isSignedInRole(role)) {
    can('subscribe', 'Channel');

    can('update', 'Channel', { ownerId: user.id });
    can('update', 'Channel', { userId: user.id });
  }

  if (role === 'CREATOR' || role === 'MODERATOR') {
    can('manage', 'Channel', { ownerId: user.id });
    can('manage', 'Channel', { userId: user.id });
  }
}
