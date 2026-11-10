import type { Notification } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';

export interface NotificationText {
  headline: string;
  /** The video's title, or the start of the comment for the comment kinds. */
  detail: string | null;
}

const PROCESSING_TEXT = {
  ready: 'notifications.processingReady',
  failed: 'notifications.processingFailed',
  held: 'notifications.processingHeld',
  approved: 'notifications.processingApproved',
  rejected: 'notifications.processingRejected',
} as const;

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
      case 'party_invite':
        return tOr('notifications.partyInvite', { name }, '');
      case 'party_starting':
        return tOr('notifications.partyStarting', {}, '');
      case 'team_invite':
        return tOr('notifications.teamInvite', { name }, '');
      case 'moderation':
        return tOr(
          'notifications.moderation',
          { action: payload.moderation?.action ?? 'hold' },
          ''
        );
      case 'processing':
        return tOr(PROCESSING_TEXT[payload.outcome ?? 'ready'], {}, '');
      default:
        return assertNever(kind, 'NotificationKind');
    }
  };

  return (notification) => ({
    headline: headlineOf(notification),
    detail: notification.payload.excerpt ?? notification.payload.videoTitle,
  });
}
