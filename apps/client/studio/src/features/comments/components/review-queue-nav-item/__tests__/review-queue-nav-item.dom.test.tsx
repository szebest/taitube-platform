import { screen, within } from '@testing-library/react';
import { inboxComment } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const nav = () => within(screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement);

describe('apps/client/studio: ReviewQueueNavItem', () => {
  it('links to the queue and counts the held comments', async () => {
    await renderInbox('/comments', [
      [inboxComment(), inboxComment({ id: '0190c3a0-5e1d-7000-8000-00000000d002' })],
    ]);

    const link = await nav().findByRole('link', { name: /Review queue/ });

    expect(link).toHaveAttribute('href', '/comments/queue');
    expect(link).toHaveTextContent('2');
  });

  it('shows no count while nothing is held', async () => {
    await renderInbox('/comments', [[]]);

    const link = await nav().findByRole('link', { name: 'Review queue' });

    expect(link).not.toHaveTextContent(/\d/);
  });
});
