import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, UserContext } from '../types/index';

export function defineAdminRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can, cannot } = builder;

  if (user?.role === 'ADMIN') {
    can('manage', 'all');
    cannot('pin', 'Video', { ownerId: { $ne: user.id } });
    cannot('heart', 'Comment', { videoOwnerId: { $ne: user.id } });
  }
}
