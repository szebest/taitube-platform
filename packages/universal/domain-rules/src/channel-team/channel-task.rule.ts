import type { ActingChannel } from '@vp/domain';
import {
  type UserContext,
  canAccessUpload,
  canModerateComments,
  canPinVideo,
  canReadAnalytics,
  canReadChannelAudit,
  canReadChannelTeam,
  canUpdateCommentSettings,
  canUpdateChannel,
  canUpdateVideo,
} from '@vp/permissions';
import { type Result, assertNever, map } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';

type ChannelTask =
  | 'read-analytics'
  | 'read-library'
  | 'read-inbox'
  | 'edit-channel'
  | 'pin-content'
  | 'upload'
  | 'read-team'
  | 'read-audit'
  | 'edit-comment-settings';

export interface ChannelTaskInput {
  readonly user: UserContext | null;
  readonly acting: ActingChannel;
  readonly task: ChannelTask;
}

function allows(
  user: UserContext | null,
  { channelId, ownerId }: ActingChannel,
  task: ChannelTask
) {
  switch (task) {
    case 'read-analytics':
      return canReadAnalytics({ user, analytics: { ownerId } });
    case 'read-library':
      return canUpdateVideo({ user, video: { ownerId } });
    case 'read-inbox':
      return canModerateComments({ user, videoOwnerId: ownerId });
    case 'edit-channel':
      return canUpdateChannel({ user, channel: { id: channelId, userId: ownerId, ownerId } });
    case 'pin-content':
      return canPinVideo({ user, video: { ownerId } });
    case 'upload':
      return canAccessUpload({ user, upload: { ownerId } });
    case 'read-team':
      return canReadChannelTeam({ user, channel: { channelId, ownerId } });
    case 'read-audit':
      return canReadChannelAudit({ user, channel: { channelId, ownerId } });
    case 'edit-comment-settings':
      return canUpdateCommentSettings({ user, channel: { channelId, ownerId } });
    default:
      return assertNever(task, 'ChannelTask');
  }
}

/** What a studio page does on the acting channel, decided by the caller's rules on its owner. */
export function decideChannelTask({
  user,
  acting,
  task,
}: ChannelTaskInput): Result<ActingChannel, AuthorizationFailure> {
  return map(
    authorize(user, allows(user, acting, task), { action: task, subject: 'Channel' }),
    () => acting
  );
}
