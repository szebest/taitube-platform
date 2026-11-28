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

/**
 * Where opening a notification goes, for a `Link` or `navigate`: a group of uploads opens the
 * channel, a comment kind its comment on the video, the post or the thread, a playlist invite the
 * page that answers it. `undefined` when there is nothing to open.
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
    case 'party_starting':
      return undefined;
    case 'playlist_invite':
      return payload.playlist?.invite
        ? linkOptions({
            to: '/playlist-invite/$token',
            params: { token: payload.playlist.invite.token },
            search: { via: 'notification' },
          })
        : undefined;
    case 'playlist_update':
      return payload.playlist
        ? linkOptions({ to: '/playlist', search: { list: payload.playlist.id } })
        : undefined;
    case 'link_request':
    case 'link_decision':
    case 'link_added':
    case 'link_suggestion':
      return undefined;
    default:
      return assertNever(kind, 'NotificationKind');
  }
}
