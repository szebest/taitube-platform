import { getUserPermissions } from '../ability';
import type { UserContext } from '../types/index';

export function canSubscribeChannel({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('subscribe', 'Channel');
}
