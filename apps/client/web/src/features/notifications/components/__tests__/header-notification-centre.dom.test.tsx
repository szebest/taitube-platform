import { act, screen, within } from '@testing-library/react';
import { getUnreadNotificationCount } from '@vp/api-contracts';
import { settleSession } from '@vp/queries';
import { account, apiServer, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import {
  notification,
  SECOND_NOTIFICATION_ID,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { arrival, renderBell } from '#app/features/notifications/__tests__/render-bell';
import { getRouter } from '#app/router';

const OTHER_USER_ID = '0190c3a0-5e1d-7000-8000-0000000000b2';

describe('apps/client/web: header notification centre', () => {
  it('has no bell for a guest', async () => {
    await renderRoute(getRouter, '/', { handlers: loaderApi() });

    expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
  });

  it.each([
    { unread: 3, name: 'Notifications 3' },
    { unread: 12, name: 'Notifications 9+' },
  ])('badges $unread unread from the stream hello as "$name"', async ({ unread, name }) => {
    const { push } = await renderBell();

    push({ type: 'hello', payload: { resume: 'fresh', unreadNotifications: unread } });

    expect(await screen.findByRole('button', { name })).toBeInTheDocument();
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
