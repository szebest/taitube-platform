import { type InfiniteData, mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { Notification } from '@vp/api-contracts';
import type { NotificationReadScope } from '@vp/domain';
import {
  notificationKeys,
  setUnreadCount,
  unreadNotificationCountQueryOptions,
  useApi,
} from '@vp/queries';
import { assertNever } from '@vp/result';
import { restoreQueryData } from '#app/integrations/query/restore-query-data';

type NotificationPages = InfiniteData<{ items: Notification[]; nextCursor: string | null }>;

function isMarked(read: NotificationReadScope, notification: Notification): boolean {
  switch (read.scope) {
    case 'all':
      return true;
    case 'ids':
      return read.ids.includes(notification.id);
    default:
      return assertNever(read, 'NotificationReadScope');
  }
}

function bodyOf(read: NotificationReadScope) {
  return read.scope === 'all' ? { all: true as const } : { ids: read.ids };
}

function markPages(pages: NotificationPages, read: NotificationReadScope): NotificationPages {
  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (isMarked(read, item) ? { ...item, read: true } : item)),
    })),
  };
}

function markReadMutationOptions(api: ApiClient) {
  const countKey = unreadNotificationCountQueryOptions(api).queryKey;
  const lists = { queryKey: notificationKeys.lists() };

  return mutationOptions({
    mutationFn: (read: NotificationReadScope) =>
      api.notifications.markNotificationsRead({ body: bodyOf(read) }),
    onMutate: async (read, { client }) => {
      await Promise.all([
        client.cancelQueries(lists),
        client.cancelQueries({ queryKey: countKey }),
      ]);
      const previousLists = client.getQueriesData<NotificationPages>(lists);
      const previousCount = client.getQueryData(countKey);

      const newlyRead = new Set(
        previousLists
          .flatMap(([, pages]) => pages?.pages.flatMap((page) => page.items) ?? [])
          .filter((item) => !item.read && isMarked(read, item))
          .map((item) => item.id)
      );
      const unread = previousCount?.unreadCount ?? 0;
      client.setQueriesData<NotificationPages>(lists, (pages) => pages && markPages(pages, read));
      setUnreadCount(client, read.scope === 'all' ? 0 : Math.max(unread - newlyRead.size, 0));
      return { previousLists, previousCount };
    },
    onSuccess: ({ unreadCount }, _read, _snapshot, { client }) =>
      setUnreadCount(client, unreadCount),
    onError: (_error, _read, snapshot, { client }) => {
      for (const [key, pages] of snapshot?.previousLists ?? []) {
        client.setQueryData(key, pages);
      }
      restoreQueryData(client, countKey, snapshot?.previousCount);
    },
    onSettled: (_data, _error, _read, _snapshot, { client }) => client.invalidateQueries(lists),
  });
}

/** Marks some notifications, or all of them, read: the rows and the badge change before the answer. */
export function useMarkRead() {
  const api = useApi();
  return useMutation(markReadMutationOptions(api));
}
