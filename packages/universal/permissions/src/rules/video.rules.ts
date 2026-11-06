import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { ownersWith } from './memberships';

export function defineVideoRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can, cannot } = builder;

  can('read', 'Video', { visibility: 'public' });
  can('read', 'Video', { visibility: 'unlisted' });

  if (!user) {
    return;
  }

  const role = user.role;

  if (role === 'MODERATOR') {
    can('read', 'Video');
  }

  if (isSignedInRole(role)) {
    can('read', 'Video', { ownerId: user.id });

    can('create', 'Video');
    can('react', 'Video');
    can('pin', 'Video', { ownerId: user.id });

    can('update', 'Video', { ownerId: user.id });
    cannot('update', 'Video', 'visibility', { ownerId: user.id, status: 'REJECTED' });
    can('delete', 'Video', { ownerId: user.id });
  }

  if (role === 'CREATOR' || role === 'MODERATOR') {
    can('publish', 'Video', { ownerId: user.id });
  }

  const readable = ownersWith(user, 'video.read');
  if (readable) can('read', 'Video', { ownerId: readable });

  const editable = ownersWith(user, 'video.edit');
  if (editable) {
    can('update', 'Video', { ownerId: editable });
    cannot('update', 'Video', 'visibility', { ownerId: editable, status: 'REJECTED' });
  }

  const deletable = ownersWith(user, 'video.delete');
  if (deletable) can('delete', 'Video', { ownerId: deletable });

  const pinnable = ownersWith(user, 'content.pin');
  if (pinnable) can('pin', 'Video', { ownerId: pinnable });
}
