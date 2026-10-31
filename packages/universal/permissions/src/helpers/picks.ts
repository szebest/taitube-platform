import { getUserPermissions } from '../ability';
import type { UserContext } from '../types/index';

export function canManagePick({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('manage', 'Pick');
}
