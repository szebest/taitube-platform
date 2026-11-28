import { assertNever } from '@kit/result';
import { linkOptions } from '@tanstack/react-router';
import type { Notification } from '@vp/api-contracts';

function watch(videoId: string | null, commentId?: string | null, threadId?: string) {
  if (!videoId) {
    return undefined;
  }
  return linkOptions({
    to: '/watch/$videoId',
    params: { videoId },
    search: {
      ...(threadId && { tab: 'threads' as const, thread: threadId }),
      ...(commentId && { comment: commentId }),
    },
  });
}

function comment({ videoId, commentId, payload }: Notification) {
  if (payload.postId) {
    return linkOptions({ to: '/post/$id', params: { id: payload.postId }, search: {} });
  }
  return watch(videoId, commentId, payload.threadId);
}

function partyRoom({ payload: { party } }: Notification, invited: boolean) {
  if (!party) {
    return undefined;
  }
  return linkOptions({
    to: '/parties/$roomId',
    params: { roomId: party.roomId },
    search: invited ? { invite: party.inviteId } : {},
  });
}

/**
 * Where opening a notification goes, for a `Link` or `navigate`: a group of uploads opens the
 * channel, a comment kind its comment on the video, the post or the thread, a party kind its room (an invite with its grant). `undefined` when there is nothing to open.
 */
export function notificationTarget(notification: Notification) {
  const { kind, videoId, actorChannelId, payload } = notification;
  switch (kind) {
    case 'upload':
      if (payload.count > 1 && actorChannelId) {
        return linkOptions({ to: '/channel/$channelId', params: { channelId: actorChannelId } });
      }
      return watch(videoId);
    case 'post':
      return actorChannelId
        ? linkOptions({ to: '/channel/$channelId', params: { channelId: actorChannelId } })
        : undefined;
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
      return comment(notification);
    case 'party_invite':
      return partyRoom(notification, true);
    case 'party_starting':
      return partyRoom(notification, false);
    default:
      return assertNever(kind, 'NotificationKind');
  }
}
