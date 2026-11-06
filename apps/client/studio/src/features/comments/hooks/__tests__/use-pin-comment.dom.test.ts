import { pinComment, unpinComment } from '@vp/api-contracts';
import { createQueryClient, creatorCommentKeys } from '@vp/queries';
import { apiServer, COMMENT_ID, comment, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { usePinComment } from '../use-pin-comment';

const INBOX = [...creatorCommentKeys.all, 'all'];

async function runPin(pinned: boolean) {
  const asked: string[] = [];
  apiServer.use(
    ...[pinComment, unpinComment].map((contract) =>
      mockEndpoint(contract, ({ request, params }) => {
        asked.push(`${request.method} ${params.id}`);
        return HttpResponse.json(comment({ isPinned: pinned }));
      })
    )
  );
  const client = createQueryClient();
  client.setQueryData(INBOX, { pages: [], pageParams: [] });

  await runMutation(client, usePinComment, { commentId: COMMENT_ID, pinned }, AppProviders);

  return { asked, invalidated: client.getQueryState(INBOX)?.isInvalidated };
}

describe('apps/client/studio: usePinComment', () => {
  it.each([
    { action: 'pins', pinned: true, method: 'POST' },
    { action: 'unpins', pinned: false, method: 'DELETE' },
  ])('$action the comment and refreshes the inbox', async ({ pinned, method }) => {
    const { asked, invalidated } = await runPin(pinned);

    expect(asked).toEqual([`${method} ${COMMENT_ID}`]);
    expect(invalidated).toBe(true);
  });
});
