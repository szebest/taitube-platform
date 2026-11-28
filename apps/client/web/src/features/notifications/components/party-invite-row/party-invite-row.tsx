import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Link } from '@tanstack/react-router';
import type { Notification } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl-formats';
import {
  NotificationCentre,
  notificationCentreStyles,
  useNotificationCentre,
} from '#app/components/shell/notification-centre';
import { useDeclinePartyInvite } from '#app/features/notifications/hooks/use-decline-party-invite';
import { useJoinPartyInvite } from '#app/features/notifications/hooks/use-join-party-invite';
import { useMarkRead } from '#app/features/notifications/hooks/use-mark-read';
import { useNotificationText } from '#app/features/notifications/hooks/use-notification-text';
import { usePartyWatchingLine } from '#app/features/notifications/hooks/use-party-watching-line';
import { useT } from '#app/lib/messages';

type PartyInvite = NonNullable<Notification['payload']['party']>;

export interface PartyInviteRowProps {
  notification: Notification;
  party: PartyInvite;
}

/**
 * A party invite: the whole row joins the room on the invite, the pill says "Join" while that can
 * still be done and "Ended" after, and the icon beside it declines. Decline, like reading, ends the pill.
 */
export function PartyInviteRow({ notification, party }: PartyInviteRowProps) {
  const { setOpen } = useNotificationCentre('PartyInviteRow');
  const { format, context } = useFormat();
  const { tOr } = useT();
  const textOf = useNotificationText();
  const watchingOf = usePartyWatchingLine();
  const markRead = useMarkRead();
  const join = useJoinPartyInvite();
  const decline = useDeclinePartyInvite();
  const styles = notificationCentreStyles();

  const { headline, detail } = textOf(notification);
  const ended = context.now !== undefined && Date.parse(party.expiresAt) <= Date.parse(context.now);
  const pending = !ended && !notification.read;

  const watching = watchingOf(party.watching);

  const open = () => {
    setOpen(false);
    if (!ended) {
      join.mutate({ roomId: party.roomId, inviteId: party.inviteId });
    }
    if (!notification.read) {
      markRead.mutate({ scope: 'ids', ids: [notification.id] });
    }
  };

  const cta = (ended || pending) && (
    <NotificationCentre.Cta ended={ended}>
      {tOr(ended ? 'party.inviteEnded' : 'party.inviteJoin', {}, '')}
    </NotificationCentre.Cta>
  );

  return (
    <NotificationCentre.Item
      asChild
      unread={!notification.read}
      avatarSrc={notification.payload.actor?.avatarUrl ?? undefined}
      time={unwrapOr(format(publishedAt(notification.createdAt).relative), '')}
      onSelect={open}
      cta={cta}
      actions={
        pending && (
          <NotificationCentre.ItemAction
            label={tOr('party.inviteDecline', {}, '')}
            onClick={() =>
              decline.mutate({ inviteId: party.inviteId, notificationId: notification.id })
            }
          />
        )
      }
    >
      <Link
        to="/parties/$roomId"
        params={{ roomId: party.roomId }}
        search={{ invite: party.inviteId }}
      >
        <span className={styles.text()}>
          {headline}
          {detail && <span className="block text-fg-muted">{detail}</span>}
          {watching && <span className="block text-fg-muted">{watching}</span>}
        </span>
      </Link>
    </NotificationCentre.Item>
  );
}
