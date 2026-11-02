import { getUserPermissions } from '../ability';
import type { UserContext } from '../types/index';

export function canCreateWebhook({ user }: { user: UserContext | null }): boolean {
  return getUserPermissions(user).can('create', 'Webhook');
}
