import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, UserContext } from '../types';

export function defineAdminRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  if (user?.role === 'ADMIN') {
    can('manage', 'all');
  }
}
