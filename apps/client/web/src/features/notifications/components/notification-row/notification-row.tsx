import { Link } from '@tanstack/react-router';
import type { Notification } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { useFormat } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import {
  NotificationCentre,
  notificationCentreStyles,
  useNotificationCentre,
} from '#app/components/shell/notification-centre';
import { useMarkRead } from '#app/features/notifications/hooks/use-mark-read';
import { useNotificationText } from '#app/features/notifications/hooks/use-notification-text';
import { notificationHref } from '#app/features/notifications/utils/notification-href';
import { notificationTarget } from '#app/features/notifications/utils/notification-target';

export interface NotificationRowProps {
  notification: Notification;
}

/** One notification: opening it marks it read, closes the centre and goes where it points. */
export function NotificationRow({ notification }: NotificationRowProps) {
  const { setOpen } = useNotificationCentre('NotificationRow');
  const { format } = useFormat();
  const textOf = useNotificationText();
  const markRead = useMarkRead();

  const { headline, detail } = textOf(notification);
  const target = notificationTarget(notification);
  const href = notificationHref(notification);
  const styles = notificationCentreStyles();

  const open = () => {
    setOpen(false);
    if (notification.read) {
      return;
    }

    markRead.mutate({ scope: 'ids', ids: [notification.id] });
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

  if (href) {
    return (
      <NotificationCentre.Item asChild {...item}>
        <a href={href}>
          <span className={styles.text()}>{words}</span>
        </a>
      </NotificationCentre.Item>
    );
  }

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
