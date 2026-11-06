import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { markNotificationsRead, type Notification } from '@vp/api-contracts';
import type { NotificationReadScope } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  createQueryClient,
  notificationKeys,
  unreadNotificationCountQueryOptions,
} from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply, runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import {
  NOTIFICATION_ID,
  notification,
  SECOND_NOTIFICATION_ID,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { useMarkRead } from '../use-mark-read';

type Pages = InfiniteData<{ items: Notification[]; nextCursor: string | null }>;

const countKey = unreadNotificationCountQueryOptions(api).queryKey;
const allKey = [...notificationKeys.lists(), { filter: 'all' }];
const mentionsKey = [...notificationKeys.lists(), { filter: 'mentions' }];

function seeded(): QueryClient {
  const client = createQueryClient();
  const first = notification();
  const second = notification({ id: SECOND_NOTIFICATION_ID, kind: 'reply' });
  client.setQueryData(countKey, { unreadCount: 5 });
  client.setQueryData<Pages>(allKey, {
    pages: [{ items: [first, second], nextCursor: null }],
    pageParams: [undefined],
  });
  client.setQueryData<Pages>(mentionsKey, {
    pages: [{ items: [second], nextCursor: null }],
    pageParams: [undefined],
  });
  return client;
}

function cached(client: QueryClient) {
  const readIds = (key: readonly unknown[]) =>
    client
      .getQueryData<Pages>(key)
      ?.pages.flatMap((page) => page.items)
      .filter((item) => item.read)
      .map((item) => item.id);
  return {
    count: client.getQueryData(countKey)?.unreadCount,
    all: readIds(allKey),
    mentions: readIds(mentionsKey),
  };
}

const markRead = (client: QueryClient, read: NotificationReadScope) =>
  runMutation(client, useMarkRead, read, AppProviders);

describe('apps/client/web: useMarkRead', () => {
  it.each<{
    scope: string;
    read: NotificationReadScope;
    count: number;
    all: string[];
    mentions: string[];
  }>([
    {
      scope: 'one notification',
      read: { scope: 'ids', ids: [SECOND_NOTIFICATION_ID] },
      count: 4,
      all: [SECOND_NOTIFICATION_ID],
      mentions: [SECOND_NOTIFICATION_ID],
    },
    {
      scope: 'every notification',
      read: { scope: 'all' },
      count: 0,
      all: [NOTIFICATION_ID, SECOND_NOTIFICATION_ID],
      mentions: [SECOND_NOTIFICATION_ID],
    },
  ])('marks $scope read in every list and the badge before the API answers', async (row) => {
    const held = heldReply(() => HttpResponse.json<{ unreadCount: number }>({ unreadCount: 2 }));
    apiServer.use(mockEndpoint(markNotificationsRead, held.answer));
    const client = seeded();

    const running = markRead(client, row.read);
    await vi.waitFor(() => expect(cached(client).count).toBe(row.count));

    expect(cached(client)).toEqual({ count: row.count, all: row.all, mentions: row.mentions });
    held.release();
    await running;
    expect(cached(client).count).toBe(2);
  });

  it('sends ids or all as the API takes them', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(markNotificationsRead, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ unreadCount: 0 });
      })
    );
    const client = seeded();

    await markRead(client, { scope: 'ids', ids: [NOTIFICATION_ID] });
    await markRead(client, { scope: 'all' });

    expect(bodies).toEqual([{ ids: [NOTIFICATION_ID] }, { all: true }]);
  });

  it('puts the rows and the badge back when the request fails', async () => {
    apiServer.use(mockEndpoint(markNotificationsRead, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded();

    const settled = await markRead(client, { scope: 'all' });

    expect(settled.status).toBe('rejected');
    expect(cached(client)).toEqual({ count: 5, all: [], mentions: [] });
  });

  it('marks every list stale once settled', async () => {
    apiServer.use(mockEndpoint(markNotificationsRead, () => HttpResponse.json({ unreadCount: 0 })));
    const client = seeded();

    await markRead(client, { scope: 'all' });

    expect(client.getQueryState(allKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(mentionsKey)?.isInvalidated).toBe(true);
  });
});
