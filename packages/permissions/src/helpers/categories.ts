import { getUserPermissions } from '../ability.js';
import type { UserContext } from '../types/index.js';

export function canManageCategory({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('manage', 'Category') || ability.can('manage', 'all');
}
