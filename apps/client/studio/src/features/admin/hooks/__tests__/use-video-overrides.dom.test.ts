import type { QueryClient } from '@tanstack/react-query';
import {
  deleteCreatorVideo,
  takeDownVideo,
  updateCreatorVideo,
} from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply, video } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { adminVideoKeys } from '#app/features/admin/api/admin-videos';
import { adminVideo } from '#app/features/admin/components/__tests__/moderation.fixture';
import { useDeleteVideo, useForcePrivate, useRejectVideo } from '../use-video-overrides';

const VIDEO = adminVideo({ version: 7 });
const LIST_KEY = adminVideoKeys.list({});

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(LIST_KEY, { pages: [], pageParams: [] });
  return client;
}

const OVERRIDES = [
  {
    override: 'force private',
    handler: mockEndpoint(updateCreatorVideo, () => HttpResponse.json(video())),
    run: (client: QueryClient) => runMutation(client, useForcePrivate, VIDEO, AppProviders),
  },
  {
    override: 'reject',
    handler: mockEndpoint(takeDownVideo, () => HttpResponse.json(video())),
    run: (client: QueryClient) =>
      runMutation(client, useRejectVideo, { video: VIDEO, reason: 'Spam' }, AppProviders),
  },
  {
    override: 'delete',
    handler: mockEndpoint(deleteCreatorVideo, () =>
      HttpResponse.json({ videoId: VIDEO.id, status: 'DELETED' as const })
    ),
    run: (client: QueryClient) => runMutation(client, useDeleteVideo, VIDEO, AppProviders),
  },
];

describe('apps/client/studio: video overrides', () => {
  it.each(OVERRIDES)('$override marks the moderation list stale', async ({ handler, run }) => {
    apiServer.use(handler);
    const client = seeded();

    const settled = await run(client);

    expect(settled.status).toBe('fulfilled');
    expect(client.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  });

  it('forces private against the version the list showed', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateCreatorVideo, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(video());
      })
    );

    await runMutation(seeded(), useForcePrivate, VIDEO, AppProviders);

    expect(bodies).toEqual([{ visibility: 'private', version: 7 }]);
  });

  it('rejects with the API error when the version is stale, and still refreshes the list', async () => {
    apiServer.use(mockEndpoint(updateCreatorVideo, () => problemReply('VERSION_CONFLICT')));
    const client = seeded();

    const settled = await runMutation(client, useForcePrivate, VIDEO, AppProviders);

    expect(settled.status).toBe('rejected');
    expect(client.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  });
});
