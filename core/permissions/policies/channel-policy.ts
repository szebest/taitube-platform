import type { ChannelResource, PolicyRule, Resource, UserContext } from '../types';

export const canUpdateChannel: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  const resource = res as ChannelResource | undefined;
  if (!resource) {
    return false;
  }
  const ownerId = resource.userId ?? resource.ownerId;
  return Boolean(ownerId && ownerId === user.id);
};

export const canManageChannel: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  if (user.role !== 'CREATOR' && user.role !== 'MODERATOR') {
    return false;
  }
  const resource = res as ChannelResource | undefined;
  if (!resource) {
    return false;
  }
  const ownerId = resource.userId ?? resource.ownerId;
  return Boolean(ownerId && ownerId === user.id);
};

export const canSubscribeChannel: PolicyRule = (user: UserContext | null): boolean => {
  return Boolean(user?.id);
};
