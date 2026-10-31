import type { HomeResponse } from '@vp/api-contracts';
import { putRecommendationFeedback, removeRecommendationFeedback } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { homeKeys } from '#app/features/home/api/home-queries';
import { relatedKeys } from '#app/features/watch/api/related-queries';
import {
  CHANNELS,
  FEEDBACK_ID,
  HOME,
  IDS,
} from '#app/features/recommendations/__tests__/recommendation-fixtures';
import {
  putFeedbackMutationOptions,
  undoFeedbackMutationOptions,
} from '../recommendation-feedback-mutations';

const saved = {
  id: FEEDBACK_ID,
  kind: 'not_interested' as const,
  videoId: IDS.night,
  createdAt: '2026-03-01T12:00:00.000Z',
};

const RELATED = { items: HOME.shelves[0]?.items ?? [] };

function seeded() {
  const client = createQueryClient();
  client.setQueryData(homeKeys.shelves(), HOME);
  client.setQueryData(relatedKeys.of('v1'), RELATED);
  return client;
}

const idsOf = (items: readonly { id: string }[] | undefined) => items?.map(({ id }) => id);

describe('apps/client/web: recommendation feedback mutations', () => {
  const notices = { saved: vi.fn(), failed: vi.fn() };

  beforeEach(() => {
    notices.saved.mockClear();
    notices.failed.mockClear();
  });

  it.each([
    {
      scenario: 'a video',
      body: { kind: 'not_interested', videoId: IDS.night },
      left: [IDS.tram, IDS.food],
    },
    {
      scenario: 'a channel',
      body: { kind: 'hide_channel', channelId: CHANNELS.lisbon.id },
      left: [IDS.tram],
    },
  ] as const)(
    'takes $scenario off the home shelves and the related list before the answer',
    async ({ body, left }) => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      apiServer.use(
        mockEndpoint(putRecommendationFeedback, async () => {
          await gate;
          return HttpResponse.json(saved);
        })
      );
      const client = seeded();

      const pending = client
        .getMutationCache()
        .build(client, putFeedbackMutationOptions(api, notices))
        .execute(body);
      await vi.waitFor(() =>
        expect(idsOf(client.getQueryData<HomeResponse>(homeKeys.shelves())?.shelves[0]?.items)).toEqual(
          left
        )
      );
      expect(idsOf(client.getQueryData<typeof RELATED>(relatedKeys.of('v1'))?.items)).toEqual(left);
      release();
      await pending;

      expect(notices.saved).toHaveBeenCalledWith(saved);
    }
  );

  it('puts the cards back and says so when the write fails', async () => {
    apiServer.use(
      mockEndpoint(putRecommendationFeedback, () => new HttpResponse(null, { status: 500 }))
    );
    const client = seeded();

    await expect(
      client
        .getMutationCache()
        .build(client, putFeedbackMutationOptions(api, notices))
        .execute({ kind: 'not_interested', videoId: IDS.night })
    ).rejects.toThrow();

    expect(client.getQueryData(homeKeys.shelves())).toEqual(HOME);
    expect(client.getQueryData(relatedKeys.of('v1'))).toEqual(RELATED);
    expect(notices.failed).toHaveBeenCalledOnce();
  });

  it('deletes the row on undo, and says so when that fails', async () => {
    const removed: string[] = [];
    apiServer.use(
      mockEndpoint(removeRecommendationFeedback, ({ params }) => {
        removed.push(String(params.id));
        return new HttpResponse(null, { status: removed.length === 1 ? 204 : 500 });
      })
    );
    const failed = vi.fn();
    const client = seeded();
    const undo = () =>
      client.getMutationCache().build(client, undoFeedbackMutationOptions(api, failed));

    await undo().execute(FEEDBACK_ID);
    await expect(undo().execute(FEEDBACK_ID)).rejects.toThrow();

    expect(removed).toEqual([FEEDBACK_ID, FEEDBACK_ID]);
    expect(failed).toHaveBeenCalledOnce();
  });
});
