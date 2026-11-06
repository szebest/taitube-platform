import { Link } from '@tanstack/react-router';
import type { Notification } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import {
  NotificationCentre,
  notificationCentreStyles,
  useNotificationCentre,
} from '#app/components/shell/notification-centre';
import { useMarkRead } from '../hooks/use-mark-read';
import { useNotificationText } from '../hooks/use-notification-text';
import { notificationTarget } from '../notification-target';

export interface NotificationRowProps {
  notification: Notification;
}

/** One notification: opening it marks it read, closes the centre and goes where it points. */
export function NotificationRow({ notification }: NotificationRowProps) {
  const { setOpen } = useNotificationCentre('NotificationRow');
  const { format } = useFormat();
  const { tOr } = useT();
  const textOf = useNotificationText();
  const markRead = useMarkRead();
  const showFailure = useFailureToast();

  const { headline, detail } = textOf(notification);
  const target = notificationTarget(notification);
  const styles = notificationCentreStyles();

  const open = () => {
    setOpen(false);
    if (notification.read) {
      return;
    }

    markRead.mutate(
      { scope: 'ids', ids: [notification.id] },
      { onError: (error) => showFailure(tOr('notifications.markReadFailed', {}, ''), error) }
    );
  };

  const words = (
    <>
      {headline}
      {detail && <span className="block text-fg-muted">{detail}</span>}
    </>
  );
  const item = {
    unread: !notification.read,
    avatarSrc: notification.payload.actor?.avatarUrl ?? undefined,
    time: unwrapOr(format(publishedAt(notification.createdAt).relative), ''),
    onSelect: open,
  };

  if (!target) {
    return <NotificationCentre.Item {...item}>{words}</NotificationCentre.Item>;
  }

  return (
    <NotificationCentre.Item asChild {...item}>
      <Link {...target}>
        <span className={styles.text()}>{words}</span>
      </Link>
    </NotificationCentre.Item>
  );
}
