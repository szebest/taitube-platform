import type { QueryClient } from '@tanstack/react-query';
import { type ContractResult, updateSubscriptionLevel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import {
  api,
  apiServer,
  CHANNEL_ID,
  mockEndpoint,
  problemReply,
  subscribedChannel,
} from '@vp/web-testing';
import { heldReply, runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { mySubscriptionsQueryOptions } from '#app/lib/query-keys/subscription-keys';
import { useSetSubscriptionLevel } from '../use-set-subscription-level';

const listKey = mySubscriptionsQueryOptions(api).queryKey;

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(listKey, { items: [subscribedChannel()], nextCursor: null });
  return client;
}

const shownLevel = (client: QueryClient) =>
  client.getQueryData(listKey)?.items[0]?.notificationLevel;

const setLevel = (client: QueryClient) =>
  runMutation(client, () => useSetSubscriptionLevel(CHANNEL_ID), 'none' as const, AppProviders);

describe('apps/client/web: useSetSubscriptionLevel', () => {
  it('shows the new level before the API answers, then marks the list stale', async () => {
    const bodies: unknown[] = [];
    const held = heldReply(() =>
      HttpResponse.json<ContractResult<typeof updateSubscriptionLevel>>({
        channelId: CHANNEL_ID,
        level: 'none',
      })
    );
    apiServer.use(
      mockEndpoint(updateSubscriptionLevel, async ({ request }) => {
        bodies.push(await request.json());
        return held.answer();
      })
    );
    const client = seeded();

    const running = setLevel(client);
    await vi.waitFor(() => expect(shownLevel(client)).toBe('none'));
    held.release();
    await running;

    expect(bodies).toEqual([{ level: 'none' }]);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it('puts the level back when the request fails', async () => {
    apiServer.use(mockEndpoint(updateSubscriptionLevel, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded();

    const settled = await setLevel(client);

    expect(settled.status).toBe('rejected');
    expect(shownLevel(client)).toBe('all');
  });
});
