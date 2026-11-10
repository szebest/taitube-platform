import { linkOptions } from '@tanstack/react-router';
import type { Notification } from '@vp/api-contracts';
import { assertNever } from '@vp/result';

function watch(videoId: string | null, commentId?: string | null) {
  if (!videoId) {
    return undefined;
  }
  return linkOptions({
    to: '/watch/$videoId',
    params: { videoId },
    search: commentId ? { comment: commentId } : {},
  });
}

/**
 * Where opening a notification goes, for a `Link` or `navigate`: a group of uploads opens the
 * channel, a comment kind its comment on the video. `undefined` when there is nothing to open.
 */
export function notificationTarget({
  kind,
  videoId,
  commentId,
  actorChannelId,
  payload,
}: Notification) {
  switch (kind) {
    case 'upload':
      if (payload.count > 1 && actorChannelId) {
        return linkOptions({ to: '/channel/$channelId', params: { channelId: actorChannelId } });
      }
      return watch(videoId);
    case 'live':
    case 'processing':
    case 'team_invite':
      return watch(videoId);
    case 'moderation':
      return linkOptions({
        to: '/feed/you/moderation',
        search: actorChannelId ? { channel: actorChannelId } : {},
      });
    case 'reply':
    case 'mention':
    case 'comment':
    case 'heart':
      return watch(videoId, commentId);
    default:
      return assertNever(kind, 'NotificationKind');
  }
}
