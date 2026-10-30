import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { NotificationCentre, NotificationCentreSkeleton } from '..';
import type { NotificationCentreLayout } from '../types';

function renderCentre({
  layout,
  unread,
}: {
  layout?: NotificationCentreLayout;
  unread?: string;
} = {}) {
  const onSelect = vi.fn();
  const onMarkAllRead = vi.fn();

  function Centre() {
    const [open, setOpen] = useState(false);

    return (
      <NotificationCentre.Root layout={layout} open={open} onOpenChange={setOpen} unread={unread}>
        <NotificationCentre.Trigger />
        <NotificationCentre.Panel>
          <NotificationCentre.Header>
            <NotificationCentre.MarkAllRead onClick={onMarkAllRead} />
          </NotificationCentre.Header>
          <NotificationCentre.Body>
            <NotificationCentre.Group heading="Today">
              <NotificationCentre.Item unread time="2 hours ago" onSelect={onSelect}>
                Lisbon Walks uploaded a video
              </NotificationCentre.Item>
              <NotificationCentre.Item time="3 days ago" onSelect={onSelect}>
                Your video passed 10,000 views
              </NotificationCentre.Item>
            </NotificationCentre.Group>
          </NotificationCentre.Body>
        </NotificationCentre.Panel>
      </NotificationCentre.Root>
    );
  }

  const user = userEvent.setup();
  render(
    <AppProviders>
      <Centre />
    </AppProviders>
  );
  return { user, onSelect, onMarkAllRead };
}

describe('apps/client/web: NotificationCentre', () => {
  it.each([
    { unread: undefined, name: 'Notifications' },
    { unread: '9+', name: 'Notifications 9+' },
  ])('names the bell with its unread count ($name)', ({ unread, name }) => {
    renderCentre({ unread });

    const bell = screen.getByRole('button', { name });

    expect(bell).toHaveAttribute('aria-haspopup', 'dialog');
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['popover', 'sheet'] as const)(
    'opens the %s from the bell, named by its heading, and Escape gives focus back',
    async (layout) => {
      const { user } = renderCentre({ layout });
      const bell = screen.getByRole('button', { name: 'Notifications' });

      await user.click(bell);
      const panel = screen.getByRole('dialog', { name: 'Notifications' });

      expect(within(panel).getByRole('region', { name: 'Today' })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(bell).toHaveFocus();
    }
  );

  it('says an item is unread in its name, and moves between items with the arrows', async () => {
    const { user, onSelect } = renderCentre();
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    const first = screen.getByRole('button', {
      name: /Lisbon Walks uploaded a video 2 hours ago, Unread/,
    });
    const second = screen.getByRole('button', { name: /passed 10,000 views 3 days ago$/ });

    first.focus();
    await user.keyboard('{ArrowDown}');

    expect(second).toHaveFocus();

    await user.keyboard('{ArrowUp}{Enter}');

    expect(first).toHaveFocus();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks all read and announces it', async () => {
    const { user, onMarkAllRead } = renderCentre();
    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    await user.click(screen.getByRole('button', { name: 'Mark all read' }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('All notifications marked as read');
  });

  it('passes axe, open and as a skeleton', async () => {
    const { user } = renderCentre({ unread: '1' });
    await user.click(screen.getByRole('button', { name: 'Notifications 1' }));
    render(<NotificationCentreSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
