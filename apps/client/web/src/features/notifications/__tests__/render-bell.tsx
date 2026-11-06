import { screen, waitFor } from '@testing-library/react';
import {
  type Account,
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
  type Notification,
  type UserEvent,
} from '@vp/api-contracts';
import { unreadNotificationCountQueryOptions } from '@vp/queries';
import { api, mockEndpoint } from '@vp/web-testing';
import { renderRoute, stubEventSource } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

export const arrival = (created: Notification): UserEvent => ({
  type: 'notification.created',
  payload: { notification: created, unreadCount: 1 },
});

interface BellOptions {
  items?: Notification[];
  unreadCount?: number;
  viewer?: Account;
  list?: Parameters<typeof mockEndpoint<typeof listNotifications>>[1];
}

/**
 * The home page for a signed-in viewer whose tab leads the user event stream, which the spec
 * drives with `push`; the API lists `items` whatever the filter (or answers with `list`), counts
 * `unreadCount`, and records the filters asked for and the bodies marked read.
 */
export async function renderBell({ items = [], unreadCount = 0, viewer, list }: BellOptions = {}) {
  const stream = stubEventSource();
  vi.spyOn(navigator.locks, 'request').mockImplementation(async (name, _options, grant) =>
    grant({ name, mode: 'exclusive' })
  );
  const filters: (string | null)[] = [];
  const marked: unknown[] = [];
  const rendered = await renderRoute(getRouter, '/', {
    handlers: [
      signInBrowser(viewer),
      mockEndpoint(getUnreadNotificationCount, () => HttpResponse.json({ unreadCount })),
      mockEndpoint(
        listNotifications,
        list ??
          (({ request }) => {
            filters.push(new URL(request.url).searchParams.get('filter'));
            return HttpResponse.json({ items, nextCursor: null });
          })
      ),
      mockEndpoint(markNotificationsRead, async ({ request }) => {
        marked.push(await request.json());
        return HttpResponse.json({ unreadCount: 0 });
      }),
      ...loaderApi(),
    ],
  });
  await waitFor(() => {
    expect(stream.urls).not.toEqual([]);
    expect(
      rendered.queryClient.getQueryData(unreadNotificationCountQueryOptions(api).queryKey)
    ).toBeDefined();
  });
  const push = (event: UserEvent | { type: 'hello'; payload: object }) =>
    stream.emit(event.type, event);
  const openBell = async (name = /^Notifications/) => {
    await rendered.user.click(await screen.findByRole('button', { name }));
    return screen.findByRole('dialog', { name: 'Notifications' });
  };
  return { ...rendered, push, openBell, filters, marked };
}
