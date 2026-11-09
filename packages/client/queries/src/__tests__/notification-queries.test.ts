import { getUnreadNotificationCount } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { createQueryClient } from '../create-query-client';
import { setUnreadCount, unreadNotificationCountQueryOptions } from '../notification-queries';

describe('@vp/queries: notification queries', () => {
  it('reads the unread count through the API client', async () => {
    apiServer.use(
      mockEndpoint(getUnreadNotificationCount, () => HttpResponse.json({ unreadCount: 3 }))
    );

    const loaded = await createQueryClient().query(unreadNotificationCountQueryOptions(api));

    expect(loaded).toEqual({ unreadCount: 3 });
  });

  it('writes a pushed count where the unread count query reads it', () => {
    const queryClient = createQueryClient();

    setUnreadCount(queryClient, 5);

    expect(queryClient.getQueryData(unreadNotificationCountQueryOptions(api).queryKey)).toEqual({
      unreadCount: 5,
    });
  });
});
