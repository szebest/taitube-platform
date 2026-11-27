import { screen, waitFor, within } from '@testing-library/react';
import type { userEvent } from '@testing-library/user-event';
import { ErrorCodes } from '@vp/errors';
import {
  HISTORY,
  REVISION_IDS,
  servePostHistory,
} from '#app/features/posts/__tests__/post-revisions.fixture';
import { managedPost } from '#app/features/posts/__tests__/posts-api.fixture';
import { renderPosts } from '#app/features/posts/__tests__/render-posts';

const POST = managedPost({ kind: 'text', text: 'Third words' }, { version: 3, isEdited: true });

async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Actions for/ }));
  await user.click(await screen.findByRole('menuitem', { name: 'Edit history' }));
  return screen.findByRole('list', { name: /versions|history/i });
}

async function render(failure?: Parameters<typeof servePostHistory>[0]) {
  const history = servePostHistory(failure);
  const page = await renderPosts('/posts', { posts: [POST] }, history.handlers);
  return { ...page, restored: history.restored };
}

describe('apps/client/studio: PostHistoryDialog', () => {
  it('lists each saved state newest first, marking the current one and what each says', async () => {
    const { user } = await render();

    const list = await openHistory(user);

    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(
      HISTORY.map((revision) =>
        expect.stringContaining((revision.payload as { text: string }).text)
      )
    );
    expect(within(rows[0] as HTMLElement).getByText('Current')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('restores a state under the post version and closes', async () => {
    const { user, restored } = await render();
    const list = await openHistory(user);

    const rows = within(list).getAllByRole('listitem');
    await user.click(within(rows[2] as HTMLElement).getByRole('button'));

    await waitFor(() => expect(restored).toEqual([{ revisionId: REVISION_IDS[2], version: 3 }]));
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: /versions|history/i })).toBeNull()
    );
  });

  it('offers to reload or overwrite when the post moved on, and overwriting asks again', async () => {
    const { user, restored } = await render(ErrorCodes.VERSION_CONFLICT);
    const list = await openHistory(user);

    const rows = within(list).getAllByRole('listitem');
    await user.click(within(rows[1] as HTMLElement).getByRole('button'));
    await screen.findByRole('dialog', { name: /changed|conflict/i });
    await user.click(screen.getByRole('button', { name: /overwrite/i }));

    await waitFor(() => expect(restored).toHaveLength(2));
  });
});
