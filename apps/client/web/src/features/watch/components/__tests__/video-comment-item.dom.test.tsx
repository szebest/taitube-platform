import { screen, within } from '@testing-library/react';
import {
  type Account,
  type CommentView,
  createComment,
  deleteComment,
  listCommentReplies,
  listVideoComments,
  updateComment,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';

import {
  AUTHOR_ID,
  COMMENT_ID,
  comment,
  OTHER_ID,
  REPLY_ID,
  viewerAccount,
} from '#app/features/watch/__tests__/comment-fixtures';
import { renderDiscussion } from '#app/features/watch/__tests__/render-discussion';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const reply = comment({ id: REPLY_ID, parentId: COMMENT_ID, content: 'Same here' });
const lastReply = comment({
  id: '0190c3a0-5e1d-7000-8000-00000000d040',
  parentId: COMMENT_ID,
  content: 'Last one',
});

interface ItemOptions {
  viewer?: Account;
  handlers?: HttpHandler[];
}

async function renderItem({ viewer, handlers = [] }: ItemOptions = {}) {
  const top: CommentView = comment({ replyCount: 2 });
  const thread = mockEndpoint(listVideoComments, () =>
    HttpResponse.json({ items: [top], nextCursor: null, total: 3 })
  );
  const rendered = await renderDiscussion({ viewer, handlers: [thread, ...handlers] });
  const article = (await screen.findByText('Ines Carvalho')).closest('article');
  if (!article) {
    throw new Error('the comment did not render');
  }

  return { ...rendered, article: within(article) };
}

describe('apps/client/web: video comment item', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expands the replies under their parent and loads more with the cursor', async () => {
    const asked: string[] = [];
    const replies = mockEndpoint(listCommentReplies, ({ request, params }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      asked.push(`${params.id}:${cursor}`);
      return cursor
        ? HttpResponse.json({ items: [lastReply], nextCursor: null })
        : HttpResponse.json({ items: [reply], nextCursor: 'more' });
    });
    const { user, article } = await renderItem({ handlers: [replies] });

    expect(screen.queryByText('Same here')).not.toBeInTheDocument();

    await user.click(article.getByRole('button', { name: 'View 2 replies' }));

    expect(await article.findByText('Same here')).toBeInTheDocument();
    expect(article.getByRole('button', { name: 'Hide replies' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(article.getByRole('button', { name: 'Show more replies' }));

    expect(await article.findByText('Last one')).toBeInTheDocument();
    expect(asked).toEqual([`${COMMENT_ID}:null`, `${COMMENT_ID}:more`]);
  });

  it('keeps a failing replies request inside the thread', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = mockEndpoint(listCommentReplies, () => problemReply(ErrorCodes.INTERNAL));
    const { user, article } = await renderItem({ handlers: [failing] });

    await user.click(article.getByRole('button', { name: 'View 2 replies' }));

    expect(await screen.findByText('The replies could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Ines Carvalho')).toBeInTheDocument();
  });

  it.each<{ viewer: string; account?: Account; actions: string[] }>([
    { viewer: 'a guest', actions: [] },
    { viewer: 'another viewer', account: viewerAccount(OTHER_ID), actions: [] },
    { viewer: 'the author', account: viewerAccount(AUTHOR_ID), actions: ['Edit', 'Delete'] },
    { viewer: 'the video owner', account: viewerAccount(OWNER_ID), actions: ['Delete'] },
    { viewer: 'a moderator', account: viewerAccount(OTHER_ID, 'MODERATOR'), actions: ['Delete'] },
  ])('gives $viewer these menu actions: $actions', async ({ account, actions }) => {
    const { user, article } = await renderItem({ viewer: account });

    if (actions.length === 0) {
      expect(article.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
      return;
    }

    await user.click(article.getByRole('button', { name: 'More actions' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(actions);
  });

  it('saves an edit with the new text', async () => {
    const saved: unknown[] = [];
    const update = mockEndpoint(updateComment, async ({ request }) => {
      saved.push(await request.json());
      return HttpResponse.json(comment({ content: 'Better text', isEdited: true }));
    });
    const { user, article } = await renderItem({
      viewer: viewerAccount(AUTHOR_ID),
      handlers: [update],
    });

    await user.click(article.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const field = article.getByRole('textbox', { name: 'Edit comment' });
    await user.clear(field);
    await user.type(field, 'Better text');
    await user.click(article.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(saved).toEqual([{ content: 'Better text' }]));
    await vi.waitFor(() => expect(article.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('replaces the text with a deleted line once deleted', async () => {
    const removed: unknown[] = [];
    const remove = mockEndpoint(deleteComment, ({ params }) => {
      removed.push(params.id);
      return new HttpResponse(null, { status: 204 });
    });
    const { user, article } = await renderItem({
      viewer: viewerAccount(AUTHOR_ID),
      handlers: [remove],
    });

    await user.click(article.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(await article.findByText('This comment was deleted')).toBeInTheDocument();
    expect(removed).toEqual([COMMENT_ID]);
  });

  it('posts a reply to the comment and opens its thread', async () => {
    const posted: unknown[] = [];
    const create = mockEndpoint(createComment, async ({ request }) => {
      posted.push(await request.json());
      return HttpResponse.json(reply, { status: 201 });
    });
    const replies = mockEndpoint(listCommentReplies, () =>
      HttpResponse.json({ items: [reply], nextCursor: null })
    );
    const { user, article } = await renderItem({
      viewer: viewerAccount(OTHER_ID),
      handlers: [create, replies],
    });

    await user.click(article.getByRole('button', { name: 'Reply' }));
    await user.type(article.getByRole('textbox'), 'Same here');
    await user.click(article.getByRole('button', { name: 'Comment' }));

    expect(await article.findByText('Same here')).toBeInTheDocument();
    expect(posted).toEqual([{ content: 'Same here', parentId: COMMENT_ID }]);
  });
});
