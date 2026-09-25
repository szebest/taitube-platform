import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { CommentResource, UserContext } from '../types/index';

export function canCreateComment({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('create', 'Comment');
}

export function canUpdateComment({
  user,
  comment,
}: {
  user: UserContext | null;
  comment: CommentResource;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('update', subject('Comment', { ...comment }));
}

export function canDeleteComment({
  user,
  comment,
  videoOwnerId,
}: {
  user: UserContext | null;
  comment: CommentResource;
  videoOwnerId: string;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('delete', subject('Comment', { ...comment, videoOwnerId }));
}

export function canPinComment({
  user,
  videoOwnerId,
}: {
  user: UserContext | null;
  videoOwnerId: string;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('pin', subject('Comment', { videoOwnerId }));
}
