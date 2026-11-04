import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { LiveStreamResource, UserContext } from '../types/index';

export function canUpdateLiveStream({
  user,
  stream,
}: {
  user: UserContext | null;
  stream: LiveStreamResource;
}): boolean {
  return getUserPermissions(user).can('update', subject('LiveStream', { ...stream }));
}
