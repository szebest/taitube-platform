import { getUserPermissions } from '../ability';
import type { UserContext } from '../types/index';

export function canManageCategory({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('manage', 'Category') || ability.can('manage', 'all');
}
