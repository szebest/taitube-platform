import { screen, waitFor, within } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import {
  COMMENT_ID,
  notification,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { renderBell } from '#app/features/notifications/__tests__/render-bell';

describe('apps/client/web: notification row', () => {
  it('opens what it is about, marks it read and closes the centre', async () => {
    const { user, router, openBell, marked } = await renderBell({
      unreadCount: 1,
      items: [notification({ kind: 'reply', commentId: COMMENT_ID }, { excerpt: 'So good' })],
    });

    const panel = await openBell();
    const reply = await within(panel).findByRole('link', { name: /Night Kitchen replied/ });
    expect(reply).toHaveTextContent('So good');
    await user.click(reply);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${VIDEO_ID}`));
    expect(router.state.location.search).toEqual({ comment: COMMENT_ID });
    expect(marked).toEqual([{ ids: [notification().id] }]);
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });
});
