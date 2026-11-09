import type { Notification } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';

export interface NotificationText {
  headline: string;
  /** The video's title, or the start of the comment for the comment kinds. */
  detail: string | null;
}

/** The words of a notification, as its row and its toast print them. */
export function useNotificationText(): (notification: Notification) => NotificationText {
  const { tOr } = useT();

  const headlineOf = ({ kind, payload }: Notification): string => {
    const name = payload.actor?.displayName ?? tOr('notifications.someone', {}, '');
    switch (kind) {
      case 'upload':
        return payload.count > 1
          ? tOr('notifications.uploads', { count: payload.count, name }, '')
          : tOr('notifications.uploaded', { name }, '');
      case 'live':
        return tOr('notifications.live', { name }, '');
      case 'reply':
        return tOr('notifications.reply', { name }, '');
      case 'mention':
        return tOr('notifications.mention', { name }, '');
      case 'comment':
        return tOr('notifications.comment', { name }, '');
      case 'heart':
        return tOr('notifications.heart', { name }, '');
      case 'team_invite':
        return tOr('notifications.teamInvite', { name }, '');
      case 'processing':
        return payload.outcome === 'failed'
          ? tOr('notifications.processingFailed', {}, '')
          : tOr('notifications.processingReady', {}, '');
      default:
        return assertNever(kind, 'NotificationKind');
    }
  };

  return (notification) => ({
    headline: headlineOf(notification),
    detail: notification.payload.excerpt ?? notification.payload.videoTitle,
  });
}
