import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import {
  notification,
  SECOND_NOTIFICATION_ID,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { renderBell } from '#app/features/notifications/__tests__/render-bell';

function connection(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

describe('apps/client/web: notification panel', () => {
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

  it('lists the notifications by day', async () => {
    const { openBell } = await renderBell({
      unreadCount: 1,
      items: [
        notification({ kind: 'reply', createdAt: new Date().toISOString() }),
        notification(
          { id: SECOND_NOTIFICATION_ID, read: true, createdAt: '2026-01-02T03:04:05.000Z' },
          { count: 3 }
        ),
      ],
    });

    const panel = await openBell();

    expect(await within(panel).findByRole('region', { name: 'Today' })).toHaveTextContent(
      'Night Kitchen replied to your comment'
    );
    expect(within(panel).getByRole('region', { name: 'Jan 2, 2026' })).toHaveTextContent(
      '3 new videos from Night Kitchen'
    );
    expect(await axeViolations()).toEqual([]);
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
});
