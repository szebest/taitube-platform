import { getUserPermissions } from '../ability.js';
import { toCommentSubject } from '../normalizers/index.js';
import type { CommentResource, UserContext } from '../types/index.js';

export function canCreateComment({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('create', 'Comment');
}

export function canDeleteComment({
  user,
  comment,
  videoOwnerId,
}: {
  user: UserContext | null;
  comment?: CommentResource;
  videoOwnerId?: string;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (!(comment || videoOwnerId)) {
    return ability.can('manage', 'all') || ability.can('delete', 'Comment');
  }
  const commentSubject = toCommentSubject(comment, videoOwnerId);
  if (!commentSubject) return false;
  return ability.can('delete', commentSubject);
}

export function canPinComment({
  user,
  videoOwnerId,
  comment,
}: {
  user: UserContext | null;
  videoOwnerId?: string;
  comment?: CommentResource;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (ability.can('manage', 'all')) return true;

  const commentSubject = toCommentSubject(comment, videoOwnerId);
  if (!commentSubject) return false;

  return ability.can('pin', commentSubject);
}
