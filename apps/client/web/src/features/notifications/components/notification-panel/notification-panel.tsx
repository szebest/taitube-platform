import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { EmptyState, NoNotificationsIllustration, SectionError } from '@vp/components';
import { NOTIFICATION_FILTERS, type NotificationFilter } from '@vp/domain';
import { useFormat, useT } from '@vp/intl-react';
import { unreadNotificationCountQueryOptions, useApi } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { Tabs } from '@vp/ui';
import { useState } from 'react';
import { PagedFooter } from '#app/components/feed/paged-footer';
import {
  NotificationCentre,
  NotificationCentreSkeletonRows,
  useNotificationCentre,
} from '#app/components/shell/notification-centre';
import { notificationsQueryOptions } from '#app/features/notifications/api/notification-queries';
import { useMarkRead } from '#app/features/notifications/hooks/use-mark-read';
import { groupByDay } from '#app/features/notifications/utils/group-by-day';
import { useOnlineStatus } from '#app/hooks/use-online-status';
import { NotificationRow } from '../notification-row/notification-row';

function isFilter(value: string): value is NotificationFilter {
  return NOTIFICATION_FILTERS.some((filter) => filter === value);
}

function NoNotifications() {
  const { setOpen } = useNotificationCentre('NoNotifications');
  const { tOr } = useT();

  return (
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
  );
}

function NotificationList({ filter }: { filter: NotificationFilter }) {
  const api = useApi();
  const { tOr } = useT();
  const { format, context } = useFormat();
  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteQuery(notificationsQueryOptions(api, filter));

  if (data === undefined && isError) {
    return (
      <SectionError.Root role="alert" retrying={isFetching} onRetry={() => void refetch()}>
        <SectionError.Message>{tOr('notifications.loadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }
  if (isPending) {
    return <NotificationCentreSkeletonRows />;
  }

  const items = data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return <NoNotifications />;
  }

  const dayOf = (instant: string) =>
    unwrapOr(format({ type: 'date', value: instant, options: { style: 'medium' } }), instant);
  const days = groupByDay(items, dayOf, context.now);
  const headings = {
    today: tOr('notifications.today', {}, ''),
    yesterday: tOr('notifications.yesterday', {}, ''),
  };

  return (
    <>
      {days.map(({ day, when, items: grouped }) => (
        <NotificationCentre.Group key={day} heading={when === 'earlier' ? day : headings[when]}>
          {grouped.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </NotificationCentre.Group>
      ))}
      <PagedFooter
        hasMore={hasNextPage}
        isFetching={isFetching}
        isError={isFetchNextPageError}
        onLoadMore={() => void fetchNextPage()}
      />
    </>
  );
}

/** The centre's open panel: mark all read, the filters, and the list of the chosen one by day. */
export function NotificationPanel() {
  const api = useApi();
  const { tOr } = useT();
  const online = useOnlineStatus();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const { data: count } = useQuery(unreadNotificationCountQueryOptions(api));
  const markRead = useMarkRead();

  const markAllRead = () => markRead.mutate({ scope: 'all' });
  const chooseFilter = (value: string) => {
    if (!isFilter(value)) {
      return;
    }

    setFilter(value);
  };

  return (
    <>
      <NotificationCentre.Header>
        <NotificationCentre.MarkAllRead disabled={!count?.unreadCount} onClick={markAllRead} />
      </NotificationCentre.Header>
      <Tabs.Root
        value={filter}
        onValueChange={chooseFilter}
        size="sm"
        className="flex min-h-0 flex-1 flex-col"
      >
        <NotificationCentre.Filters>
          <Tabs.List aria-label={tOr('notifications.filtersLabel', {}, '')}>
            {NOTIFICATION_FILTERS.map((each) => (
              <Tabs.Tab key={each} value={each}>
                {tOr('notifications.filter', { filter: each }, '')}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </NotificationCentre.Filters>
        {!online && (
          <NotificationCentre.Notice>
            {tOr('notifications.offline', {}, '')}
          </NotificationCentre.Notice>
        )}
        <Tabs.Panel value={filter} className="flex min-h-0 flex-1 flex-col">
          <NotificationCentre.Body>
            <NotificationList filter={filter} />
          </NotificationCentre.Body>
        </Tabs.Panel>
      </Tabs.Root>
    </>
  );
}
