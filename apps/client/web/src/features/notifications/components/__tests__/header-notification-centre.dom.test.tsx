import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import {
  type Account,
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
  type Notification,
  type UserEvent,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { settleSession, unreadNotificationCountQueryOptions } from '@vp/queries';
import { account, api, apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { axeViolations, renderRoute, stubEventSource } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import {
  COMMENT_ID,
  notification,
  SECOND_NOTIFICATION_ID,
} from '../../__tests__/notification-fixtures';

function connection(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

const arrival = (created: Notification): UserEvent => ({
  type: 'notification.created',
  payload: { notification: created, unreadCount: 1 },
});

const OTHER_USER_ID = '0190c3a0-5e1d-7000-8000-0000000000b2';

interface BellOptions {
  items?: Notification[];
  unreadCount?: number;
  viewer?: Account;
  list?: Parameters<typeof mockEndpoint<typeof listNotifications>>[1];
}

/**
 * The home page for a signed-in viewer whose tab leads the user event stream, which the spec
 * drives with `push`; the API lists `items` whatever the filter and counts `unreadCount`.
 */
async function renderBell({ items = [], unreadCount = 0, viewer, list }: BellOptions = {}) {
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

describe('apps/client/web: header notification centre', () => {
  it('has no bell for a guest', async () => {
    await renderRoute(getRouter, '/', { handlers: loaderApi() });

    expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
  });

  it('opens its empty state from the bell, with the way to manage subscriptions', async () => {
    const { user, router, openBell } = await renderBell();

    const panel = await openBell();

    expect(
      await within(panel).findByRole('heading', { name: 'No notifications yet' })
    ).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);

    await user.click(within(panel).getByRole('link', { name: 'Manage subscriptions' }));

    expect(router.state.location.pathname).toBe('/subscriptions');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it.each([
    { unread: 3, name: 'Notifications 3' },
    { unread: 12, name: 'Notifications 9+' },
  ])('badges $unread unread from the stream hello as "$name"', async ({ unread, name }) => {
    const { push } = await renderBell();

    push({ type: 'hello', payload: { resume: 'fresh', unreadNotifications: unread } });

    expect(await screen.findByRole('button', { name })).toBeInTheDocument();
  });

  it('lists the notifications by day, each opening what it is about and marking it read', async () => {
    const today = new Date().toISOString();
    const { user, router, openBell, marked } = await renderBell({
      unreadCount: 2,
      items: [
        notification(
          { kind: 'reply', commentId: COMMENT_ID, createdAt: today },
          { excerpt: 'So good' }
        ),
        notification(
          { id: SECOND_NOTIFICATION_ID, read: true, createdAt: '2026-01-02T03:04:05.000Z' },
          { count: 3 }
        ),
      ],
    });

    const panel = await openBell();
    const todayGroup = await within(panel).findByRole('region', { name: 'Today' });
    const reply = within(todayGroup).getByRole('link', { name: /Night Kitchen replied/ });

    expect(within(panel).getByRole('region', { name: 'Jan 2, 2026' })).toHaveTextContent(
      '3 new videos from Night Kitchen'
    );
    expect(reply).toHaveTextContent('So good');
    expect(await axeViolations()).toEqual([]);

    await user.click(reply);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${VIDEO_ID}`));
    expect(router.state.location.search).toEqual({ comment: COMMENT_ID });
    expect(marked).toEqual([{ ids: [notification().id] }]);
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('asks for the chosen filter', async () => {
    const { user, openBell, filters } = await renderBell({ items: [notification()] });

    const panel = await openBell();
    await within(panel).findByRole('link', { name: /uploaded a video/ });
    await user.click(within(panel).getByRole('tab', { name: 'Replies' }));

    await waitFor(() => expect(filters).toEqual(['all', 'mentions']));
  });

  it('marks everything read at once and says so', async () => {
    const { user, openBell, marked } = await renderBell({
      unreadCount: 1,
      items: [notification()],
    });

    const panel = await openBell(/^Notifications 1/);
    await user.click(await within(panel).findByRole('button', { name: 'Mark all read' }));

    expect(within(panel).getByText('All notifications marked as read')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Mark all read' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(marked).toEqual([{ all: true }]);
  });

  it('clears the badge when another tab or device marks them read', async () => {
    const { push } = await renderBell({ unreadCount: 4 });
    await screen.findByRole('button', { name: 'Notifications 4' });

    push({ type: 'notification.read', payload: { scope: 'all', unreadCount: 0 } });

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it.each([
    { kind: 'reply' as const, toast: 'Night Kitchen replied to your comment' },
    { kind: 'mention' as const, toast: 'Night Kitchen mentioned you' },
  ])('raises the badge and a toast for an arriving $kind', async ({ kind, toast }) => {
    const { push } = await renderBell();

    push(arrival(notification({ kind })));

    expect(await screen.findByRole('button', { name: 'Notifications 1' })).toBeInTheDocument();
    expect(await screen.findByText(toast)).toBeInTheDocument();
  });

  it('announces an arriving upload politely, with no toast', async () => {
    const { push } = await renderBell();

    push(arrival(notification()));

    expect(await screen.findByRole('button', { name: 'Notifications 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').map((region) => region.textContent)).toContain(
      'Night Kitchen uploaded a video'
    );
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  });

  it('refetches the open list and announces nothing when one arrives while it is open', async () => {
    let items = [notification()];
    const { push, openBell } = await renderBell({
      list: () => HttpResponse.json({ items, nextCursor: null }),
    });
    const panel = await openBell();
    await within(panel).findByRole('link', { name: /uploaded a video/ });

    const live = notification({ id: SECOND_NOTIFICATION_ID, kind: 'live' });
    items = [live, ...items];
    push(arrival(live));

    expect(await within(panel).findByRole('link', { name: /is live now/ })).toBeInTheDocument();
    expect(screen.getAllByRole('status').map((region) => region.textContent)).not.toContain(
      'Night Kitchen is live now'
    );
  });

  it('offers a retry when the list fails, and shows it once it loads', async () => {
    let fail = true;
    const { user, openBell } = await renderBell({
      list: () =>
        fail
          ? problemReply(ErrorCodes.INTERNAL)
          : HttpResponse.json({ items: [notification()], nextCursor: null }),
    });

    const panel = await openBell();
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('Notifications could not load');

    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(
      await within(panel).findByRole('link', { name: /uploaded a video/ })
    ).toBeInTheDocument();
  });

  it('keeps the loaded notifications under a notice while offline', async () => {
    const { openBell } = await renderBell({ items: [notification()] });
    const panel = await openBell();
    await within(panel).findByRole('link', { name: /uploaded a video/ });

    connection(false);
    onTestFinished(() => onlineManager.setOnline(true));

    expect(
      within(panel).getByText('You are offline. These are the notifications you last loaded.')
    ).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /uploaded a video/ })).toBeInTheDocument();
  });

  it("shows only the new account's count after an account switch", async () => {
    const { router } = await renderBell({ unreadCount: 4 });
    await screen.findByRole('button', { name: 'Notifications 4' });

    const other = account();
    apiServer.use(
      signInBrowser({ ...other, user: { ...other.user, id: OTHER_USER_ID } }),
      mockEndpoint(getUnreadNotificationCount, () => HttpResponse.json({ unreadCount: 1 }))
    );
    await act(() => settleSession(router));

    expect(await screen.findByRole('button', { name: 'Notifications 1' })).toBeInTheDocument();
  });
});
