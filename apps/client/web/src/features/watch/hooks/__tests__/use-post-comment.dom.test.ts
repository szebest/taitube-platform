import { createComment } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';

import { COMMENT_ID, comment, REPLY_ID } from '#app/features/watch/__tests__/comment-fixtures';
import { commentKeys } from '#app/features/watch/api/comment-queries';
import { usePostComment } from '../use-post-comment';

function seeded() {
  const client = createQueryClient();
  client.setQueryData(commentKeys.list(VIDEO_ID, 'top'), { pages: [], pageParams: [] });
  client.setQueryData(commentKeys.replies(COMMENT_ID), { pages: [], pageParams: [] });
  return client;
}

const stale = (client: ReturnType<typeof seeded>) => ({
  list: client.getQueryState(commentKeys.list(VIDEO_ID, 'top'))?.isInvalidated,
  replies: client.getQueryState(commentKeys.replies(COMMENT_ID))?.isInvalidated,
});

describe('apps/client/web: usePostComment', () => {
  it.each([
    {
      posted: 'a comment',
      variables: { content: 'Hello' },
      expected: { list: true, replies: false },
    },
    {
      posted: 'a reply',
      variables: { content: 'Hello', parentId: COMMENT_ID },
      expected: { list: true, replies: true },
    },
  ])('marks what $posted changes stale once settled', async ({ variables, expected }) => {
    apiServer.use(
      mockEndpoint(createComment, () =>
        HttpResponse.json(comment({ id: REPLY_ID }), { status: 201 })
      )
    );
    const client = seeded();

    await runMutation(client, () => usePostComment(VIDEO_ID), variables, AppProviders);

    expect(stale(client)).toEqual(expected);
  });

  it('rejects when the API refuses the comment', async () => {
    apiServer.use(mockEndpoint(createComment, () => problemReply(ErrorCodes.INTERNAL)));

    const settled = await runMutation(
      seeded(),
      () => usePostComment(VIDEO_ID),
      { content: 'Hello' },
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });

  it.each([
    { name: 'a worker holds the comment', controller: {}, stale: false },
    { name: 'no worker holds the comment', controller: null, stale: true },
  ])('on a network error, refetches the thread unless $name', async ({ controller, stale }) => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller },
      configurable: true,
    });
    apiServer.use(mockEndpoint(createComment, () => HttpResponse.error()));
    const client = seeded();

    await runMutation(client, () => usePostComment(VIDEO_ID), { content: 'Hello' }, AppProviders);

    expect(client.getQueryState(commentKeys.list(VIDEO_ID, 'top'))?.isInvalidated).toBe(stale);
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
});
