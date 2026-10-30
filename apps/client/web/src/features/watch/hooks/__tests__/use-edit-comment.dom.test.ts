import { updateComment } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';

import { COMMENT_ID, comment } from '#app/features/watch/__tests__/comment-fixtures';
import { commentKeys } from '#app/features/watch/api/comment-queries';
import { useEditComment } from '../use-edit-comment';

describe('apps/client/web: useEditComment', () => {
  it('sends the new text and marks every comment list stale', async () => {
    const saved: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateComment, async ({ request, params }) => {
        saved.push([params.id, await request.json()]);
        return HttpResponse.json(comment({ content: 'New', isEdited: true }));
      })
    );
    const client = createQueryClient();
    client.setQueryData(commentKeys.list(VIDEO_ID, 'top'), { pages: [], pageParams: [] });
    client.setQueryData(commentKeys.replies(COMMENT_ID), { pages: [], pageParams: [] });

    await runMutation(client, () => useEditComment(COMMENT_ID), 'New', AppProviders);

    expect(saved).toEqual([[COMMENT_ID, { content: 'New' }]]);
    expect(
      [commentKeys.list(VIDEO_ID, 'top'), commentKeys.replies(COMMENT_ID)].map(
        (key) => client.getQueryState(key)?.isInvalidated
      )
    ).toEqual([true, true]);
  });
});
