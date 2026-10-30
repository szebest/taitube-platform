import type { QueryClient } from '@tanstack/react-query';
import { discardDlqEntry, replayDlqEntry } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { adminDlqKeys } from '#app/features/admin/api/admin-dlq';
import { useDiscardDlqEntry, useReplayDlqEntry } from '../use-dlq-mutations';

const LIST_KEY = adminDlqKeys.list(undefined);

const seeded = () => {
  const client = createQueryClient();
  client.setQueryData(LIST_KEY, { pages: [], pageParams: [] });
  client.setQueryData(adminDlqKeys.parked(), { count: 1, more: false });
  return client;
};

const WRITES = [
  {
    write: 'replay',
    handler: mockEndpoint(replayDlqEntry, () =>
      HttpResponse.json(
        { status: 'REPLAYED' as const, dlqEntryId: 'dlq-1', replayJobId: 'r1' },
        { status: 202 }
      )
    ),
    run: (client: QueryClient) => runMutation(client, useReplayDlqEntry, 'dlq-1', AppProviders),
  },
  {
    write: 'discard',
    handler: mockEndpoint(discardDlqEntry, () => new HttpResponse(null, { status: 204 })),
    run: (client: QueryClient) => runMutation(client, useDiscardDlqEntry, 'dlq-1', AppProviders),
  },
];

describe('apps/client/studio: DLQ mutations', () => {
  it.each(WRITES)('$write marks the list and the parked count stale', async ({ handler, run }) => {
    apiServer.use(handler);
    const client = seeded();

    const settled = await run(client);

    expect(settled.status).toBe('fulfilled');
    expect(client.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryState(adminDlqKeys.parked())?.isInvalidated).toBe(true);
  });

  it('rejects when the entry is gone', async () => {
    apiServer.use(mockEndpoint(discardDlqEntry, () => problemReply('DLQ_ENTRY_NOT_FOUND')));

    const settled = await runMutation(seeded(), useDiscardDlqEntry, 'dlq-1', AppProviders);

    expect(settled.status).toBe('rejected');
  });
});
