import { type Result, assertNever, map } from '@kit/result';
import type { ActingChannel } from '@vp/domain';
import {
  type UserContext,
  canAccessUpload,
  canActAsChannel,
  canModerateComments,
  canPinVideo,
  canRestrictChannelUser,
  canReadAnalytics,
  canReadChannelAudit,
  canReadChannelTeam,
  canUpdateCommentSettings,
  canUpdateChannel,
  canUpdateVideo,
} from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';

type ChannelTask =
  | 'read-analytics'
  | 'read-library'
  | 'read-inbox'
  | 'edit-channel'
  | 'edit-page'
  | 'pin-content'
  | 'upload'
  | 'read-team'
  | 'read-audit'
  | 'edit-comment-settings'
  | 'restrict-users'
  | 'comment-as'
  | 'subscribe-as';

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
      return canReadAnalytics({ user, analytics: { ownerId, channelId } });
    case 'read-library':
      return canUpdateVideo({ user, video: { ownerId, channelId } });
    case 'read-inbox':
      return canModerateComments({ user, videoOwnerId: ownerId, videoChannelId: channelId });
    case 'edit-channel':
    case 'edit-page':
      return canUpdateChannel({ user, channel: { id: channelId, userId: ownerId, ownerId } });
    case 'pin-content':
      return canPinVideo({ user, video: { ownerId, channelId } });
    case 'upload':
      return canAccessUpload({ user, upload: { ownerId, channelId } });
    case 'read-team':
      return canReadChannelTeam({ user, channel: { channelId, ownerId } });
    case 'read-audit':
      return canReadChannelAudit({ user, channel: { channelId, ownerId } });
    case 'edit-comment-settings':
      return canUpdateCommentSettings({ user, channel: { channelId, ownerId } });
    case 'restrict-users':
      return canRestrictChannelUser({ user, channel: { channelId, ownerId } });
    case 'comment-as':
    case 'subscribe-as':
      return canActAsChannel({ user, channel: { id: channelId, ownerId } });
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
