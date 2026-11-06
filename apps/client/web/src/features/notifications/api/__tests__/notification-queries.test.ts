import { listNotifications } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import {
  notification,
  SECOND_NOTIFICATION_ID,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { notificationsQueryOptions } from '../notification-queries';

describe('apps/client/web: notification queries', () => {
  it('pages through one filter by cursor', async () => {
    const asked: [string | null, string | null][] = [];
    apiServer.use(
      mockEndpoint(listNotifications, ({ request }) => {
        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        asked.push([searchParams.get('filter'), cursor]);
        return HttpResponse.json(
          cursor
            ? { items: [notification({ id: SECOND_NOTIFICATION_ID })], nextCursor: null }
            : { items: [notification()], nextCursor: 'next' }
        );
      })
    );

    const pages = await createQueryClient().fetchInfiniteQuery({
      ...notificationsQueryOptions(api, 'mentions'),
      pages: 2,
    });

    expect(pages.pages.flatMap((page) => page.items.map(({ id }) => id))).toEqual([
      notification().id,
      SECOND_NOTIFICATION_ID,
    ]);
    expect(asked).toEqual([
      ['mentions', null],
      ['mentions', 'next'],
    ]);
  });
});
