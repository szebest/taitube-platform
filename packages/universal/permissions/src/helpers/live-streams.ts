import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { LiveStreamResource, UserContext } from '../types/index';

interface LiveStreamCheck {
  user: UserContext | null;
  stream: LiveStreamResource;
}

export function canUpdateLiveStream({ user, stream }: LiveStreamCheck): boolean {
  return getUserPermissions(user).can('update', subject('LiveStream', { ...stream }));
}

/** Removing chat lines, and posting past slow mode and subscribers-only. */
export function canModerateLiveStream({ user, stream }: LiveStreamCheck): boolean {
  return getUserPermissions(user).can('moderate', subject('LiveStream', { ...stream }));
}
