import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

export function defineUploadRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  if (!user) {
    return;
  }

  const role = user.role;

  if (isSignedInRole(role)) {
    can('create', 'Upload');
    can('access', 'Upload', { ownerId: user.id });
  }

  const editable = channelsWith(user, 'video.edit');
  if (editable) can('access', 'Upload', { channelId: editable });
}
