import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { CaptionResource, UserContext } from '../types/index';

interface CaptionCheck {
  user: UserContext | null;
  caption: CaptionResource;
}

export function canReadCaptions({ user, caption }: CaptionCheck): boolean {
  return getUserPermissions(user).can('read', subject('Caption', { ...caption }));
}

export function canManageCaptions({ user, caption }: CaptionCheck): boolean {
  return getUserPermissions(user).can('manage', subject('Caption', { ...caption }));
}
