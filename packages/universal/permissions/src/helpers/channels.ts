import { getUserPermissions } from '../ability.js';
import { toChannelSubject } from '../normalizers/index.js';
import type { ChannelResource, UserContext } from '../types/index.js';

export function canUpdateChannel({
  user,
  channel,
}: {
  user: UserContext | null;
  channel?: ChannelResource;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (!channel) {
    return ability.can('manage', 'all');
  }
  const channelSubject = toChannelSubject(channel);
  if (!channelSubject) return false;
  return ability.can('update', channelSubject);
}

export function canSubscribeChannel({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('subscribe', 'Channel');
}

export function canManageChannel({
  user,
  channel,
}: {
  user: UserContext | null;
  channel?: ChannelResource;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (!channel) {
    return ability.can('manage', 'all');
  }
  const channelSubject = toChannelSubject(channel);
  if (!channelSubject) return false;
  return ability.can('manage', channelSubject);
}
