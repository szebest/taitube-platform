import type { AbilityBuilder } from '@casl/ability';
import { ErrorCodes } from '@vp/errors';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

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

    can('appeal', 'Video', { ownerId: user.id, status: 'HELD' });
    can('appeal', 'Video', {
      ownerId: user.id,
      status: 'REJECTED',
      errorCode: ErrorCodes.SCREENING_REJECTED,
    });
  }

  if (role === 'CREATOR' || role === 'MODERATOR') {
    can('publish', 'Video', { ownerId: user.id });
  }

  const readable = channelsWith(user, 'video.read');
  if (readable) can('read', 'Video', { channelId: readable });

  const editable = channelsWith(user, 'video.edit');
  if (editable) {
    can('update', 'Video', { channelId: editable });
    cannot('update', 'Video', 'visibility', { channelId: editable, status: 'REJECTED' });
  }

  const deletable = channelsWith(user, 'video.delete');
  if (deletable) can('delete', 'Video', { channelId: deletable });

  const pinnable = channelsWith(user, 'content.pin');
  if (pinnable) can('pin', 'Video', { channelId: pinnable });
}
