import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@vp/api-contracts';
import { inboxComment, VIDEO_ID } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const NEW = inboxComment({ id: '0190c3a0-5e1d-7000-8000-00000000d010', content: 'Just landed' });

const created = (comment = NEW): UserEvent => ({
  type: 'comment.created',
  payload: {
    comment: {
      id: comment.id,
      parentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt,
      author: { userId: comment.author.userId, handle: null, displayName: null },
    },
    video: { id: VIDEO_ID, title: comment.video.title },
  },
});

describe('apps/client/studio: /comments', () => {
  it('lists every comment by default, reached from the studio navigation', async () => {
    const { requests } = await renderInbox('/comments', [[inboxComment()]]);

    expect(screen.getByRole('combobox', { name: 'Show' })).toHaveTextContent('All');
    expect(requests.lists).toEqual([{ filter: 'all', cursor: null }]);
    expect(
      within(screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement).getByRole(
        'link',
        { name: 'Comments' }
      )
    ).toHaveAttribute('aria-current', 'page');
  });

  it('restores the filter from the address', async () => {
    const { requests } = await renderInbox('/comments?filter=reported');

    expect(screen.getByRole('combobox', { name: 'Show' })).toHaveTextContent('Reported');
    expect(requests.lists).toEqual([{ filter: 'reported', cursor: null }]);
  });

  it('shows a new comment the moment it lands', async () => {
    const stream = streamUserEvents();
    const { pages } = await renderInbox('/comments', [[inboxComment()]]);
    await screen.findByText(inboxComment().content);

    pages[0]?.unshift(NEW);
    stream.send(created());

    expect(await screen.findByText('Just landed')).toBeInTheDocument();
  });
});
