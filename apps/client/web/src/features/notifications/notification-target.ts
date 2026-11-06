import type { Notification } from '@vp/api-contracts';
import { assertNever } from '@vp/result';

export type NotificationTarget =
  | { page: 'watch'; videoId: string; commentId?: string }
  | { page: 'channel'; channelId: string }
  | { page: 'none' };

const NOWHERE: NotificationTarget = { page: 'none' };

function watch(videoId: string | null, commentId?: string | null): NotificationTarget {
  if (!videoId) {
    return NOWHERE;
  }
  return commentId ? { page: 'watch', videoId, commentId } : { page: 'watch', videoId };
}

/** Where opening a notification goes: a group of uploads opens the channel, a comment its anchor. */
export function notificationTarget({
  kind,
  videoId,
  commentId,
  actorChannelId,
  payload,
}: Notification): NotificationTarget {
  switch (kind) {
    case 'upload':
      if (payload.count > 1 && actorChannelId) {
        return { page: 'channel', channelId: actorChannelId };
      }
      return watch(videoId);
    case 'live':
    case 'processing':
      return watch(videoId);
    case 'reply':
    case 'mention':
    case 'comment':
    case 'heart':
      return watch(videoId, commentId);
    default:
      return assertNever(kind, 'NotificationKind');
  }
}
