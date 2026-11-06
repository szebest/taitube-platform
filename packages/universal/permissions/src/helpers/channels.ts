import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { ChannelResource, UserContext } from '../types/index';

export function canSubscribeChannel({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('subscribe', 'Channel');
}

export function canUpdateChannel({
  user,
  channel,
}: {
  user: UserContext | null;
  channel: ChannelResource;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('update', subject('Channel', { ...channel }));
}
