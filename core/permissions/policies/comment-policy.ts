import type { CommentResource, PolicyRule, Resource, UserContext } from '../types';

export const canCreateComment: PolicyRule = (user: UserContext | null): boolean => {
  if (!user) {
    return false;
  }
  return ['USER', 'CREATOR', 'MODERATOR', 'ADMIN'].includes(user.role as string);
};

export const canDeleteComment: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') {
    return true;
  }
  const resource = res as CommentResource | undefined;
  if (!resource) {
    return false;
  }
  if (resource.authorId && resource.authorId === user.id) {
    return true;
  }
  if (resource.videoOwnerId && resource.videoOwnerId === user.id) {
    return true;
  }
  return false;
};

export const canPinComment: PolicyRule = (user: UserContext | null, res?: Resource): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  const resource = res as CommentResource | undefined;
  if (!resource?.videoOwnerId) {
    return false;
  }
  return resource.videoOwnerId === user.id;
};
