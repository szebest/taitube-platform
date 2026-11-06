import { screen, within } from '@testing-library/react';
import { inboxComment, VIDEO_ID } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const FIRST = inboxComment();
const OLDER = inboxComment({
  id: '0190c3a0-5e1d-7000-8000-00000000d009',
  content: 'An older one',
  author: { ...FIRST.author, displayName: 'Marta' },
});

const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('apps/client/studio: CommentInbox', () => {
  it('lists each comment with its video, author and text', async () => {
    await renderInbox('/comments', [[FIRST]]);

    const row = within(rowOf(FIRST.content));

    expect(row.getByRole('link', { name: 'Alfama at 5 a.m.' })).toHaveAttribute(
      'href',
      `http://localhost:5173/watch/${VIDEO_ID}`
    );
    expect(row.getByText('Ines Carvalho')).toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST], [OLDER]]);

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('An older one')).toBeInTheDocument();
    expect(requests.lists.map(({ cursor }) => cursor)).toEqual([null, '1']);
  });

  it('says so when nothing matches the filter', async () => {
    await renderInbox('/comments?filter=reported', [[]]);

    expect(await screen.findByText('No comments here')).toBeInTheDocument();
  });

  it('opens a reply in the row and closes it once posted', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST]]);
    const row = within(rowOf(FIRST.content));

    await user.click(row.getByRole('button', { name: 'Reply' }));
    await user.type(row.getByRole('textbox', { name: 'Your reply' }), 'Thank you');
    await user.click(row.getByRole('button', { name: 'Post reply' }));

    expect(await screen.findByText('Reply posted')).toBeInTheDocument();
    expect(requests.replies).toEqual([
      { videoId: VIDEO_ID, body: { content: 'Thank you', parentId: FIRST.id } },
    ]);
    expect(row.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
