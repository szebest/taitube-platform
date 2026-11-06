import { createComment } from '@vp/api-contracts';
import { createQueryClient, creatorCommentKeys } from '@vp/queries';
import {
  apiServer,
  COMMENT_ID,
  comment,
  inboxComment,
  mockEndpoint,
  VIDEO_ID,
} from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useReplyToComment } from '../use-reply-to-comment';

const INBOX = [...creatorCommentKeys.all, 'unanswered'];
const REPLY_ID = '0190c3a0-5e1d-7000-8000-00000000d002';

describe('apps/client/studio: useReplyToComment', () => {
  it.each([
    { replyingTo: 'a top-level comment', target: inboxComment() },
    { replyingTo: 'a reply', target: inboxComment({ id: REPLY_ID, parentId: COMMENT_ID }) },
  ])('answers $replyingTo in its thread and refreshes the inbox', async ({ target }) => {
    const posted: unknown[] = [];
    apiServer.use(
      mockEndpoint(createComment, async ({ request, params }) => {
        posted.push({ videoId: params.id, ...(await request.json()) });
        return HttpResponse.json(comment(), { status: 201 });
      })
    );
    const client = createQueryClient();
    client.setQueryData(INBOX, { pages: [], pageParams: [] });

    await runMutation(client, () => useReplyToComment(target), 'Thank you', AppProviders);

    expect(posted).toEqual([{ videoId: VIDEO_ID, content: 'Thank you', parentId: COMMENT_ID }]);
    expect(client.getQueryState(INBOX)?.isInvalidated).toBe(true);
  });
});
