import { getUserPermissions } from '../ability.js';
import type { UserContext } from '../types/index.js';

export function canViewAllAnalytics({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('read', 'Analytics') || ability.can('manage', 'all');
}
