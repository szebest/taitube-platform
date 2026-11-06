import { screen, waitFor, within } from '@testing-library/react';
import { deleteComment } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { commentItem, uuid } from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '#app/features/library/__tests__/render-library';
import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';

const COMMENTS = [
  commentItem(1, 'First thoughts'),
  commentItem(2, 'Second'),
  commentItem(3, 'Third'),
];

const URL = '/feed/history?tab=comments';

const deleteFirst = async (user: Awaited<ReturnType<typeof renderLibrary>>['user']) => {
  const row = (await screen.findByText('First thoughts')).closest('li');
  if (!row) throw new Error('no row around the comment');
  await user.click(within(row).getByRole('button', { name: 'Delete comment' }));
};

describe('apps/client/web: CommentsList', () => {
  useLibraryClock();

  it('lists the comments, each linked to its video', async () => {
    await renderLibrary(URL, { comments: COMMENTS });

    await screen.findByText('First thoughts');

    expect(screen.getAllByRole('link', { name: 'On Video 1' })[0]).toHaveAttribute(
      'href',
      `/watch/${uuid(1)}`
    );
  });

  it('shows one line when nothing was written', async () => {
    await renderLibrary(URL);

    expect(await screen.findByText('No comments yet')).toBeInTheDocument();
  });

  describe('paging by keyset', () => {
    beforeEach(() => RecordingObserver.install());
    afterEach(() => vi.unstubAllGlobals());

    it('asks for the next page with the cursor once the end is near', async () => {
      await renderLibrary(URL, { comments: COMMENTS, pageSize: 2 });
      await screen.findByText('First thoughts');
      expect(screen.queryByText('Third')).toBeNull();

      RecordingObserver.enterView();

      expect(await screen.findByText('Third')).toBeInTheDocument();
    });
  });

  describe('deleting a comment', () => {
    it('drops it before the server answers', async () => {
      const held = heldReply(() => new HttpResponse<null>(null, { status: 204 }));
      const { user } = await renderLibrary(URL, {
        comments: COMMENTS,
        handlers: [mockEndpoint(deleteComment, held.answer)],
      });

      await deleteFirst(user);

      await waitFor(() => expect(screen.queryByText('First thoughts')).toBeNull());
      expect(screen.getByText('Second')).toBeInTheDocument();
      held.release();
    });

    it('puts it back and says so when the server refuses', async () => {
      const { user } = await renderLibrary(URL, {
        comments: COMMENTS,
        handlers: [mockEndpoint(deleteComment, () => problemReply(ErrorCodes.INTERNAL))],
      });

      await deleteFirst(user);

      expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
      expect(await screen.findByText('First thoughts')).toBeInTheDocument();
    });
  });
});
