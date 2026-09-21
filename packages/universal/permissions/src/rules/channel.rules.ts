import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, UserContext } from '../types';

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

  if (role === 'USER' || role === 'CREATOR' || role === 'MODERATOR' || role === 'ADMIN') {
    can('subscribe', 'Channel');

    can('update', 'Channel', { ownerId: user.id });
    can('update', 'Channel', { userId: user.id });
  }

  if (role === 'CREATOR' || role === 'MODERATOR') {
    can('manage', 'Channel', { ownerId: user.id });
    can('manage', 'Channel', { userId: user.id });
  }
}
