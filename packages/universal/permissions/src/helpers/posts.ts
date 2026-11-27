import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { PostResource, UserContext } from '../types/index';

export type PostAction = 'create' | 'update' | 'delete' | 'pin';

export function canManagePost({
  user,
  action,
  post,
}: {
  user: UserContext | null;
  action: PostAction;
  post: PostResource;
}): boolean {
  return getUserPermissions(user).can(action, subject('Post', { ...post }));
}

export function canReadPostStats({
  user,
  post,
}: {
  user: UserContext | null;
  post: PostResource;
}): boolean {
  return getUserPermissions(user).can('read', subject('PostStats', { ...post }));
}
