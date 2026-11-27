import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { ThreadResource, UserContext } from '../types/index';

export function canPinThread({
  user,
  thread,
}: {
  user: UserContext | null;
  thread: ThreadResource;
}): boolean {
  return getUserPermissions(user).can('pin', subject('Thread', { ...thread }));
}
