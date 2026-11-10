import { approveHeldVideo, dismissScreeningFlags, rejectHeldVideo } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { screeningCase } from '#app/features/admin/__tests__/screening.fixture';
import { adminScreeningKeys, type ScreeningPages } from '#app/features/admin/api/admin-screening';
import { type ScreeningAction, useScreeningDecision } from '../use-screening-decision';

const HELD = screeningCase();
const OTHER = screeningCase();
const listKey = adminScreeningKeys.list(undefined);

const seeded = () => {
  const client = createQueryClient();
  const pages: ScreeningPages = {
    pages: [{ items: [HELD, OTHER], nextCursor: null }],
    pageParams: [undefined],
  };
  client.setQueryData(listKey, pages);
  return client;
};

const itemsOf = (client: ReturnType<typeof seeded>) =>
  client.getQueryData<ScreeningPages>(listKey)?.pages[0]?.items;

describe('apps/client/studio: useScreeningDecision', () => {
  it.each([
    {
      case: 'approves a held video',
      action: { kind: 'approve', videoId: HELD.videoId } as ScreeningAction,
      endpoint: approveHeldVideo,
      decision: 'approved',
      status: 'PROCESSING' as const,
      body: undefined,
    },
    {
      case: 'rejects it with the reason',
      action: { kind: 'reject', videoId: HELD.videoId, reason: 'A copy' } as ScreeningAction,
      endpoint: rejectHeldVideo,
      decision: 'rejected',
      status: 'REJECTED' as const,
      body: { reason: 'A copy' },
    },
    {
      case: 'dismisses the flags and leaves the status',
      action: { kind: 'dismiss', videoId: HELD.videoId } as ScreeningAction,
      endpoint: dismissScreeningFlags,
      decision: 'dismissed',
      status: 'HELD' as const,
      body: undefined,
    },
  ])(
    '$case, shows it at once and marks the lists stale',
    async ({ action, endpoint, decision, status, body }) => {
      const sent: unknown[] = [];
      apiServer.use(
        mockEndpoint(endpoint, async ({ request, params }) => {
          sent.push(body === undefined ? params['id'] : await request.json());
          return HttpResponse.json({ videoId: HELD.videoId, status });
        })
      );
      const client = seeded();

      const settled = await runMutation(client, useScreeningDecision, action, AppProviders);

      expect(settled.status).toBe('fulfilled');
      expect(sent).toEqual([body ?? HELD.videoId]);
      expect(itemsOf(client)?.[0]).toMatchObject({ decision, status, open: false });
      expect(itemsOf(client)?.[1]).toEqual(OTHER);
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    }
  );

  it('puts the case back when the API refuses', async () => {
    apiServer.use(mockEndpoint(approveHeldVideo, () => problemReply('VERSION_CONFLICT')));
    const client = seeded();

    const settled = await runMutation(
      client,
      useScreeningDecision,
      { kind: 'approve', videoId: HELD.videoId },
      AppProviders
    );

    expect(settled.status).toBe('rejected');
    expect(itemsOf(client)).toEqual([HELD, OTHER]);
  });
});
