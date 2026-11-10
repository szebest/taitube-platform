import {
  createSavedReply,
  deleteSavedReply,
  listRestrictions,
  listSavedReplies,
  listTrustedCommenters,
  trustCommenter,
  untrustCommenter,
  updateSavedReply,
} from '@vp/api-contracts';
import { api, apiServer, COMMENT_AUTHOR_ID, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import {
  restrictionsQueryOptions,
  savedRepliesQueryOptions,
  trustedCommentersQueryOptions,
  useChangeSavedReply,
  useTrustCommenter,
} from '../channel-moderation-queries';
import { createQueryClient } from '../create-query-client';
import { moderationKeys } from '../moderation-queries';

const REPLY = {
  id: '0190c3a0-5e1d-7000-8000-00000000a0a1',
  title: 'Thanks',
  body: 'Thank you!',
  position: 0,
};

function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

const refreshed = (client: ReturnType<typeof createQueryClient>, key: readonly unknown[]) => {
  client.setQueryData(key, { pages: [], pageParams: [] });
  return () => client.getQueryState(key)?.isInvalidated;
};

describe('@vp/queries: channel moderation queries', () => {
  it('reads the first page of the restrictions and of the trusted commenters', async () => {
    apiServer.use(
      mockEndpoint(listRestrictions, () => HttpResponse.json({ items: [], nextCursor: null })),
      mockEndpoint(listTrustedCommenters, () => HttpResponse.json({ items: [], nextCursor: null }))
    );
    const client = createQueryClient();

    const restrictions = await client.fetchInfiniteQuery(restrictionsQueryOptions(api));
    const trusted = await client.fetchInfiniteQuery(trustedCommentersQueryOptions(api));

    expect([restrictions.pages, trusted.pages]).toEqual([
      [{ items: [], nextCursor: null }],
      [{ items: [], nextCursor: null }],
    ]);
  });

  it('reads the saved replies as a list', async () => {
    apiServer.use(mockEndpoint(listSavedReplies, () => HttpResponse.json({ items: [REPLY] })));
    const client = createQueryClient();

    await client.prefetchQuery(savedRepliesQueryOptions(api));

    expect(client.getQueryData(moderationKeys.savedReplies())).toEqual({ items: [REPLY] });
  });

  it.each([
    { trusted: true, contract: trustCommenter, method: 'PUT' },
    { trusted: false, contract: untrustCommenter, method: 'DELETE' },
  ])(
    'sends $method to trust: $trusted, then reloads the trusted list',
    async ({ trusted, contract, method }) => {
      const asked: string[] = [];
      apiServer.use(
        mockEndpoint(contract, ({ request }) => {
          asked.push(request.method);
          return new HttpResponse(null, { status: 204 });
        })
      );
      const client = createQueryClient();
      const invalidated = refreshed(client, moderationKeys.trusted());

      await runMutation(client, useTrustCommenter, { userId: COMMENT_AUTHOR_ID, trusted }, WithApi);

      expect(asked).toEqual([method]);
      expect(invalidated()).toBe(true);
    }
  );

  it.each([
    {
      change: { type: 'create' as const, reply: { title: 'Thanks', body: 'Thank you!' } },
      contract: createSavedReply,
      method: 'POST',
      answer: () => HttpResponse.json(REPLY, { status: 201 }),
    },
    {
      change: { type: 'update' as const, id: REPLY.id, edit: { position: 2 } },
      contract: updateSavedReply,
      method: 'PATCH',
      answer: () => HttpResponse.json(REPLY),
    },
    {
      change: { type: 'delete' as const, id: REPLY.id },
      contract: deleteSavedReply,
      method: 'DELETE',
      answer: () => new HttpResponse(null, { status: 204 }),
    },
  ])(
    'sends a $change.type as $method and reloads the saved replies',
    async ({ change, contract, method, answer }) => {
      const asked: string[] = [];
      apiServer.use(
        mockEndpoint(contract as typeof createSavedReply, ({ request }) => {
          asked.push(request.method);
          return answer() as never;
        })
      );
      const client = createQueryClient();
      const invalidated = refreshed(client, moderationKeys.savedReplies());

      await runMutation(client, useChangeSavedReply, change, WithApi);

      expect(asked).toEqual([method]);
      expect(invalidated()).toBe(true);
    }
  );
});
