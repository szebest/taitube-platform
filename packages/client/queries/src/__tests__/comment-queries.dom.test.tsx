import { heartComment, unheartComment } from '@vp/api-contracts';
import { api, apiServer, COMMENT_ID, comment, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import { creatorCommentKeys, useHeartComment } from '../comment-queries';
import { createQueryClient } from '../create-query-client';

const VIDEO_COMMENTS = ['comments', 'video', 'v1', 'top'];
const INBOX = [...creatorCommentKeys.all, 'all'];

function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

async function runHeart(hearted: boolean) {
  const asked: string[] = [];
  apiServer.use(
    ...[heartComment, unheartComment].map((contract) =>
      mockEndpoint(contract, ({ request, params }) => {
        asked.push(`${request.method} ${params.id}`);
        return HttpResponse.json(comment({ heartedByCreator: hearted }));
      })
    )
  );
  const client = createQueryClient();
  for (const key of [VIDEO_COMMENTS, INBOX]) {
    client.setQueryData(key, { pages: [], pageParams: [] });
  }

  await runMutation(client, useHeartComment, { commentId: COMMENT_ID, hearted }, WithApi);

  return {
    asked,
    invalidated: [VIDEO_COMMENTS, INBOX].map((key) => client.getQueryState(key)?.isInvalidated),
  };
}

describe('@vp/queries: useHeartComment', () => {
  it.each([
    { action: 'hearts', hearted: true, method: 'POST' },
    { action: 'unhearts', hearted: false, method: 'DELETE' },
  ])(
    '$action the comment and refreshes the watch page and inbox lists',
    async ({ hearted, method }) => {
      const { asked, invalidated } = await runHeart(hearted);

      expect(asked).toEqual([`${method} ${COMMENT_ID}`]);
      expect(invalidated).toEqual([true, true]);
    }
  );
});
