import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { NotificationFilter } from '@vp/domain';
import { KEYSET_PAGE_SIZE, keysetPaging, notificationKeys } from '@vp/queries';

export function notificationsQueryOptions(api: ApiClient, filter: NotificationFilter) {
  return infiniteQueryOptions({
    queryKey: [...notificationKeys.lists(), { filter }],
    queryFn: ({ pageParam, signal }) =>
      api.notifications.listNotifications({
        query: { filter, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
        signal,
      }),
    ...keysetPaging,
  });
}
