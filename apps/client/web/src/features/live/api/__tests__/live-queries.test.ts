import { getLiveChatReplay } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, chatMessage, LIVE_STREAM_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { chatReplayQueryOptions } from '../live-queries';

describe('apps/client/web: live queries', () => {
  it.each([
    { window: 0, query: 'fromMs=0&toMs=30000' },
    { window: 2, query: 'fromMs=60000&toMs=90000' },
  ])(
    'asks the replay of window $window for its stretch of the broadcast',
    async ({ window, query }) => {
      const asked: string[] = [];
      apiServer.use(
        mockEndpoint(getLiveChatReplay, ({ request }) => {
          asked.push(new URL(request.url).search);
          return HttpResponse.json({ items: [chatMessage(1, 'hi')] });
        })
      );

      const replay = await createQueryClient().fetchQuery(
        chatReplayQueryOptions(api, LIVE_STREAM_ID, window)
      );

      expect(asked).toEqual([`?${query}`]);
      expect(replay).toHaveLength(1);
    }
  );

  it('reads on from the last offset of a full page, showing each line once', async () => {
    const lines = Array.from({ length: 600 }, (_, index) => ({
      ...chatMessage(index, `line ${index}`),
      offsetMs: index * 10,
    }));
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(getLiveChatReplay, ({ request }) => {
        const { searchParams } = new URL(request.url);
        const fromMs = Number(searchParams.get('fromMs'));
        asked.push(String(fromMs));
        return HttpResponse.json({
          items: lines.filter(({ offsetMs }) => offsetMs >= fromMs).slice(0, 500),
        });
      })
    );

    const replay = await createQueryClient().fetchQuery(
      chatReplayQueryOptions(api, LIVE_STREAM_ID, 0)
    );

    expect(asked).toEqual(['0', '4990']);
    expect(replay.map(({ id }) => id)).toEqual(lines.map(({ id }) => id));
  });
});
