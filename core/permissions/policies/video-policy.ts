import type { PolicyRule, Resource, UserContext, VideoResource } from '../types';

export const canReadVideo: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  const resource = res as VideoResource | undefined;
  if (!resource) {
    return true;
  }
  if (user && (user.role === 'ADMIN' || user.role === 'MODERATOR')) {
    return true;
  }
  const visibility = resource.visibility ?? 'public';
  if (visibility === 'public' || visibility === 'unlisted') {
    return true;
  }
  if (visibility === 'private') {
    return Boolean(user && resource.ownerId && resource.ownerId === user.id);
  }
  return true;
};

export const canCreateVideo: PolicyRule = (user: UserContext | null): boolean => {
  if (!user) {
    return false;
  }
  return ['USER', 'CREATOR', 'MODERATOR', 'ADMIN'].includes(user.role as string);
};

export const canUpdateVideo: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  const resource = res as VideoResource | undefined;
  if (!resource?.ownerId) {
    return false;
  }
  return resource.ownerId === user.id;
};

export const canDeleteVideo: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  const resource = res as VideoResource | undefined;
  if (!resource?.ownerId) {
    return false;
  }
  return resource.ownerId === user.id;
};

export const canPublishVideo: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  if (user.role === 'USER') {
    return false;
  }
  if (user.role === 'CREATOR' || user.role === 'MODERATOR') {
    const resource = res as VideoResource | undefined;
    if (!resource?.ownerId) {
      return true;
    }
    return resource.ownerId === user.id;
  }
  return false;
};
