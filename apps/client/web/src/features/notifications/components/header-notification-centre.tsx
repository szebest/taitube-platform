import { Link } from '@tanstack/react-router';
import { EmptyState, NoNotificationsIllustration } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { useMediaQuery } from '@vp/ui';
import { useState } from 'react';

import { NotificationCentre } from '#app/components/shell/notification-centre';

const POPOVER_FITS = '(min-width: 600px)';

/** The header bell for a signed-in viewer; its designed empty state until the notifications feature lands. */
export function HeaderNotificationCentre() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const popoverFits = useMediaQuery(POPOVER_FITS);
  const { tOr } = useT();

  if (!account) {
    return null;
  }

  return (
    <NotificationCentre.Root
      layout={popoverFits ? 'popover' : 'sheet'}
      open={open}
      onOpenChange={setOpen}
    >
      <NotificationCentre.Trigger />
      <NotificationCentre.Panel>
        <NotificationCentre.Header />
        <NotificationCentre.Body>
          <EmptyState.Root size="section">
            <EmptyState.Illustration>
              <NoNotificationsIllustration />
            </EmptyState.Illustration>
            <EmptyState.Title asChild>
              <h3>{tOr('notifications.emptyTitle', {}, '')}</h3>
            </EmptyState.Title>
            <EmptyState.Description>
              {tOr('notifications.emptyDescription', {}, '')}
            </EmptyState.Description>
            <EmptyState.Action asChild>
              <Link to="/subscriptions" onClick={() => setOpen(false)}>
                {tOr('notifications.manageSubscriptions', {}, '')}
              </Link>
            </EmptyState.Action>
          </EmptyState.Root>
        </NotificationCentre.Body>
      </NotificationCentre.Panel>
    </NotificationCentre.Root>
  );
}
