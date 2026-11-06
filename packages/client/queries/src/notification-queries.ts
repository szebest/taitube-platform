import { type QueryClient, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
};

/** The bell's number: fetched once, then kept by the user event stream's `hello` and live events. */
export function unreadNotificationCountQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => api.notifications.getUnreadNotificationCount(),
  });
}

export function setUnreadCount(queryClient: QueryClient, unreadCount: number) {
  queryClient.setQueryData<{ unreadCount: number }>(notificationKeys.unreadCount(), {
    unreadCount,
  });
}
