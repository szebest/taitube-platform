import { heartComment, pinComment, unheartComment, unpinComment } from '@vp/api-contracts';
import { api, apiServer, COMMENT_ID, comment, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import { creatorCommentKeys, useHeartComment, usePinComment } from '../comment-queries';
import { createQueryClient } from '../create-query-client';

const VIDEO_COMMENTS = ['comments', 'video', 'v1', 'top'];
const INBOX = [...creatorCommentKeys.all, 'all'];

function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

async function run<TVariables>(
  hook: () => { mutateAsync: (variables: TVariables) => Promise<unknown> },
  variables: TVariables,
  contracts: (typeof heartComment | typeof unheartComment)[]
) {
  const asked: string[] = [];
  apiServer.use(
    ...contracts.map((contract) =>
      mockEndpoint(contract, ({ request, params }) => {
        asked.push(`${request.method} ${params.id}`);
        return HttpResponse.json(comment());
      })
    )
  );
  const client = createQueryClient();
  for (const key of [VIDEO_COMMENTS, INBOX]) {
    client.setQueryData(key, { pages: [], pageParams: [] });
  }

  await runMutation(client, hook, variables, WithApi);

  return {
    asked,
    invalidated: [VIDEO_COMMENTS, INBOX].map((key) => client.getQueryState(key)?.isInvalidated),
  };
}

const MUTATIONS = {
  heart: (on: boolean) =>
    run(useHeartComment, { commentId: COMMENT_ID, hearted: on }, [heartComment, unheartComment]),
  pin: (on: boolean) =>
    run(usePinComment, { commentId: COMMENT_ID, pinned: on }, [pinComment, unpinComment]),
};

describe('@vp/queries: comment mutations', () => {
  it.each([
    { kind: 'heart', on: true, method: 'POST' },
    { kind: 'heart', on: false, method: 'DELETE' },
    { kind: 'pin', on: true, method: 'POST' },
    { kind: 'pin', on: false, method: 'DELETE' },
  ] as const)(
    '$kind $on sends $method and refreshes the watch page and inbox lists',
    async ({ kind, on, method }) => {
      const { asked, invalidated } = await MUTATIONS[kind](on);

      expect(asked).toEqual([`${method} ${COMMENT_ID}`]);
      expect(invalidated).toEqual([true, true]);
    }
  );
});
