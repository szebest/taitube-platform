import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, UserContext } from '../types';

export function defineUploadRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  if (!user) {
    return;
  }

  const role = user.role;

  if (role === 'USER' || role === 'CREATOR' || role === 'MODERATOR' || role === 'ADMIN') {
    can('create', 'Upload');
    can('access', 'Upload', { ownerId: user.id });
  }
}
