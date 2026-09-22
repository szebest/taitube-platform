import { getUserPermissions } from '../ability.js';
import type { UserContext } from '../types/index.js';

export function canAccessAdmin({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('manage', 'all');
}
