import { deleteComment } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';

import { COMMENT_ID } from '#app/features/watch/__tests__/comment-fixtures';
import { commentKeys } from '#app/features/watch/api/comment-queries';
import { useDeleteComment } from '../use-delete-comment';

describe('apps/client/web: useDeleteComment', () => {
  it('deletes the comment and marks the lists stale without reloading the one on screen', async () => {
    const removed: unknown[] = [];
    let reloads = 0;
    apiServer.use(
      mockEndpoint(deleteComment, ({ params }) => {
        removed.push(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const key = commentKeys.list(VIDEO_ID, 'top');
    const client = createQueryClient();
    client.setQueryData(key, { pages: [], pageParams: [] });
    client.setQueryDefaults(key, {
      queryFn: () => {
        reloads += 1;
        return { pages: [], pageParams: [] };
      },
    });

    await runMutation(client, () => useDeleteComment(COMMENT_ID), undefined, AppProviders);

    expect(removed).toEqual([COMMENT_ID]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(reloads).toBe(0);
  });
});
