import type { QueryClient } from '@tanstack/react-query';
import { cancelPick, createPick, updatePick } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { adminPickKeys } from '#app/features/admin/api/admin-picks';
import { adminPick, inHours } from '#app/features/admin/components/__tests__/picks.fixture';
import { useCancelPick, useCreatePick, useUpdatePick } from '../use-pick-mutations';

const PICK = adminPick();

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(adminPickKeys.all, [PICK]);
  return client;
}

const WRITES = [
  {
    write: 'create',
    handler: mockEndpoint(createPick, () => HttpResponse.json(PICK, { status: 201 })),
    run: (client: QueryClient) =>
      runMutation(
        client,
        useCreatePick,
        { videoId: PICK.videoId, startsAt: inHours(24), endsAt: inHours(48) },
        AppProviders
      ),
  },
  {
    write: 'update',
    handler: mockEndpoint(updatePick, () => HttpResponse.json(PICK)),
    run: (client: QueryClient) =>
      runMutation(client, useUpdatePick, { id: PICK.id, changes: { note: null } }, AppProviders),
  },
  {
    write: 'cancel',
    handler: mockEndpoint(cancelPick, () => new HttpResponse(null, { status: 204 })),
    run: (client: QueryClient) => runMutation(client, useCancelPick, PICK.id, AppProviders),
  },
];

describe('apps/client/studio: pick mutations', () => {
  it.each(WRITES)('$write marks the picks query stale', async ({ handler, run }) => {
    apiServer.use(handler);
    const client = seeded();

    const settled = await run(client);

    expect(settled.status).toBe('fulfilled');
    expect(client.getQueryState(adminPickKeys.all)?.isInvalidated).toBe(true);
  });

  it('rejects with the API error when the write is refused', async () => {
    apiServer.use(mockEndpoint(cancelPick, () => problemReply('PICK_NOT_FOUND')));

    const settled = await runMutation(seeded(), useCancelPick, PICK.id, AppProviders);

    expect(settled.status).toBe('rejected');
  });
});
