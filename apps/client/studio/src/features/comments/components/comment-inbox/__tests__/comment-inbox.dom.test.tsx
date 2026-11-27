import { screen, within } from '@testing-library/react';
import { inboxComment, VIDEO_ID } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const FIRST = inboxComment();
const OLDER = inboxComment({
  id: '0190c3a0-5e1d-7000-8000-00000000d009',
  content: 'An older one',
  author: { ...FIRST.author, displayName: 'Marta' },
});

const POST_ID = '0190c3a0-5e1d-7000-8000-00000000d00b';
const POST_COMMENT = inboxComment({
  id: '0190c3a0-5e1d-7000-8000-00000000d00c',
  content: 'On a post',
  target: { type: 'post', id: POST_ID },
  videoId: null,
  targetSummary: { type: 'post', id: POST_ID, title: 'Which topic next?' },
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

  it.each([
    { target: 'a video', comment: FIRST, chip: 'Video', title: 'Alfama at 5 a.m.' },
    {
      target: 'a post',
      comment: inboxComment({
        id: '0190c3a0-5e1d-7000-8000-00000000d00a',
        content: 'Count me in',
        target: { type: 'post', id: POST_ID },
        videoId: null,
        targetSummary: { type: 'post', id: POST_ID, title: 'Which topic next?' },
      }),
      chip: 'Post',
      title: 'Which topic next?',
    },
  ])(
    'marks a comment on $target with a $chip chip over its title',
    async ({ comment, chip, title }) => {
      await renderInbox('/comments', [[comment]]);

      const row = within(rowOf(comment.content));

      expect(row.getByText(chip)).toBeInTheDocument();
      expect(row.getByText(title)).toBeInTheDocument();
    }
  );

  it('links only a video, never a post', async () => {
    await renderInbox('/comments', [[POST_COMMENT]]);

    expect(within(rowOf(POST_COMMENT.content)).queryByRole('link')).toBeNull();
  });

  it('loads the next page on request', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST], [OLDER]]);

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('An older one')).toBeInTheDocument();
    expect(
      requests.lists.filter(({ filter }) => filter === 'all').map(({ cursor }) => cursor)
    ).toEqual([null, '1']);
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
