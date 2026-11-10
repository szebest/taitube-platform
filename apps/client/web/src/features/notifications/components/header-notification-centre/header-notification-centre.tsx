import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Notification } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { unreadNotificationCountQueryOptions, useAccount, useApi, useUserEvent } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { Button, Icon, useMediaQuery, useToast, useUiCopy } from '@vp/ui';
import { useState } from 'react';
import { NotificationCentre } from '#app/components/shell/notification-centre';
import { useMarkRead } from '#app/features/notifications/hooks/use-mark-read';
import { useNotificationText } from '#app/features/notifications/hooks/use-notification-text';
import { notificationTarget } from '#app/features/notifications/utils/notification-target';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { LazyNotificationPanel } from '../notification-panel/notification-panel.lazy';

const POPOVER_FITS = '(min-width: 600px)';
const MOST_SHOWN = 9;

interface Announcement {
  text: string;
  count: number;
}

/**
 * What a notification arriving with the centre closed does: a reply or a mention gets a toast that
 * opens it, the rest a polite announcement, which this returns for the caller's live region. `count`
 * keys the line, so a second identical arrival is a new node a screen reader announces again.
 */
function useArrivals(open: boolean): Announcement {
  const [announcement, setAnnouncement] = useState<Announcement>({ text: '', count: 0 });
  const { tOr } = useT();
  const navigate = useNavigate();
  const showToast = useToast();
  const textOf = useNotificationText();
  const markRead = useMarkRead();

  const visit = (notification: Notification) => {
    markRead.mutate({ scope: 'ids', ids: [notification.id] });
    const target = notificationTarget(notification);
    if (target) {
      void navigate(target);
    }
  };

  useUserEvent('notification.created', ({ payload: { notification } }) => {
    if (open) {
      return;
    }

    const { headline, detail } = textOf(notification);
    if (notification.kind !== 'reply' && notification.kind !== 'mention') {
      setAnnouncement(({ count }) => ({ text: headline, count: count + 1 }));
      return;
    }
    showToast({
      title: headline,
      description: detail ?? undefined,
      action: { label: tOr('notifications.view', {}, ''), onAction: () => visit(notification) },
    });
  });

  return announcement;
}

function GuestBell() {
  const { notifications } = useUiCopy();
  const { run } = useRequireAccount('bell');

  return (
    <Button variant="ghost" shape="icon" onClick={() => run(() => undefined)}>
      <Icon name="bell" />
      <span className="sr-only">{notifications}</span>
    </Button>
  );
}

/** The header bell: for a signed-in viewer the unread count, live arrivals and the centre it opens, for a guest the sign-in prompt. */
export function HeaderNotificationCentre() {
  const account = useAccount();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const popoverFits = useMediaQuery(POPOVER_FITS);
  const { format } = useFormat();
  const { data } = useQuery({
    ...unreadNotificationCountQueryOptions(api),
    enabled: account !== undefined,
  });
  const announcement = useArrivals(open);

  if (!account) {
    return <GuestBell />;
  }

  const unreadCount = data?.unreadCount ?? 0;
  const shown = unwrapOr(format({ type: 'number', value: Math.min(unreadCount, MOST_SHOWN) }), '');
  const unread = unreadCount === 0 ? undefined : unreadCount > MOST_SHOWN ? `${shown}+` : shown;

  return (
    <>
      <NotificationCentre.Root
        layout={popoverFits ? 'popover' : 'sheet'}
        open={open}
        onOpenChange={setOpen}
        unread={unread}
      >
        <NotificationCentre.Trigger />
        <NotificationCentre.Panel>
          <LazyNotificationPanel />
        </NotificationCentre.Panel>
      </NotificationCentre.Root>
      <span role="status" className="sr-only">
        <span key={announcement.count}>{announcement.text}</span>
      </span>
    </>
  );
}
