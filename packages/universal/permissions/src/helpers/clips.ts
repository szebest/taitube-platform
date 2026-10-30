import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { ClipResource, UserContext } from '../types/index';

interface ClipCheck {
  user: UserContext | null;
  clip: ClipResource;
}

export function canCreateClip({ user, clip }: ClipCheck): boolean {
  return getUserPermissions(user).can('create', subject('Clip', { ...clip }));
}

export function canDeleteClip({ user, clip }: ClipCheck): boolean {
  return getUserPermissions(user).can('delete', subject('Clip', { ...clip }));
}
