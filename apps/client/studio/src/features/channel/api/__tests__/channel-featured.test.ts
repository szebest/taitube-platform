import { MutationObserver } from '@tanstack/react-query';
import { ApiError } from '@vp/api-client';
import {
  type ChannelFeaturedView,
  getChannelFeatured,
  listCreatorVideos,
  setChannelFeatured,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import {
  api,
  apiServer,
  CHANNEL_ID,
  mockEndpoint,
  problemReply,
  videoSummary,
} from '@vp/web-testing';
import { delay, HttpResponse } from 'msw';

import {
  featuredQueryOptions,
  pickableVideosQueryOptions,
  saveFeaturedMutationOptions,
} from '../channel-featured';

const FIRST = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a001', title: 'First' });
const SECOND = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a002', title: 'Second' });
const BEFORE: ChannelFeaturedView = { source: 'pinned', items: [FIRST] };
const KEY = featuredQueryOptions(api, CHANNEL_ID).queryKey;

describe('apps/client/studio: channel featured queries', () => {
  it('reads the shelf by the channel, apart from the picker', async () => {
    apiServer.use(mockEndpoint(getChannelFeatured, () => HttpResponse.json(BEFORE)));

    const loaded = await createQueryClient().fetchQuery(featuredQueryOptions(api, CHANNEL_ID));

    expect(loaded.items.map(({ id }) => id)).toEqual([FIRST.id]);
    expect(KEY).not.toEqual(pickableVideosQueryOptions(api).queryKey);
  });

  it('asks the library only for public videos that are ready', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(listCreatorVideos, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], nextCursor: null });
      })
    );

    await createQueryClient().fetchInfiniteQuery(pickableVideosQueryOptions(api));

    expect(asked).toHaveLength(1);
    const query = new URLSearchParams(asked[0]);
    expect([query.get('status'), query.get('visibility')]).toEqual(['READY', 'public']);
  });

  describe('save', () => {
    const save = (client = createQueryClient()) => {
      client.setQueryData(KEY, BEFORE);
      return {
        client,
        mutate: (pins: typeof BEFORE.items) =>
          new MutationObserver(client, saveFeaturedMutationOptions(api, CHANNEL_ID)).mutate(pins),
      };
    };

    it('shows the new order in the cache before the API answers, then the answer', async () => {
      const answer: ChannelFeaturedView = { source: 'pinned', items: [SECOND, FIRST] };
      apiServer.use(
        mockEndpoint(setChannelFeatured, async () => {
          await delay(150);
          return HttpResponse.json(answer);
        })
      );
      const { client, mutate } = save();

      const saved = mutate([SECOND, FIRST]);
      await vi.waitFor(() =>
        expect(client.getQueryData<ChannelFeaturedView>(KEY)?.items).toEqual([SECOND, FIRST])
      );
      await saved;

      expect(client.getQueryData(KEY)).toEqual(answer);
    });

    it('puts the shelf back as it was when the API refuses', async () => {
      apiServer.use(
        mockEndpoint(setChannelFeatured, async () => {
          await delay(150);
          return problemReply(ErrorCodes.FORBIDDEN);
        })
      );
      const { client, mutate } = save();

      const refused = expect(mutate([SECOND])).rejects.toBeInstanceOf(ApiError);
      await vi.waitFor(() =>
        expect(client.getQueryData<ChannelFeaturedView>(KEY)?.items).toEqual([SECOND])
      );
      await refused;

      expect(client.getQueryData(KEY)).toEqual(BEFORE);
    });

    it('takes an empty list as the fallback shelf', async () => {
      apiServer.use(
        mockEndpoint(setChannelFeatured, async () => {
          await delay(150);
          return HttpResponse.json({ source: 'popular', items: [] });
        })
      );
      const { client, mutate } = save();

      const saved = mutate([]);
      await vi.waitFor(() =>
        expect(client.getQueryData(KEY)).toEqual({ source: 'popular', items: [] })
      );
      await saved;
    });
  });
});
